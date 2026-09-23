/* Generated from api-src. Edit api-src and lib, then run npm run bundle-api. */


// lib/neon.ts
var SESSION_COOKIE = "hv_session";
var HttpError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
function readSessionToken(request) {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return void 0;
  }
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }
    if (part.slice(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return void 0;
}
async function queryRows(connectionString, query, params = []) {
  const payload = await neonRequest(connectionString, query, params);
  if (!isNeonRows(payload)) {
    throw new Error("Neon HTTP response did not include rows.");
  }
  return payload.rows;
}
async function execute(connectionString, query, params = []) {
  await neonRequest(connectionString, query, params);
}
function requireDatabaseUrl() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new HttpError("DATABASE_URL is not configured.", 503);
  }
  return connectionString;
}
function resolveDatabaseUrl() {
  const fromUrl = process.env.DATABASE_URL?.trim();
  if (fromUrl) {
    return toHttpDriverUrl(fromUrl);
  }
  const horrorVerseDb = process.env.HorrorVerseDb?.trim();
  if (!horrorVerseDb) {
    return void 0;
  }
  if (/^postgres(ql)?:\/\//i.test(horrorVerseDb)) {
    return toHttpDriverUrl(horrorVerseDb);
  }
  return toHttpDriverUrl(npgsqlToUri(horrorVerseDb));
}
async function requireSessionUser(request, connectionString) {
  const token = readSessionToken(request);
  if (!token) {
    throw new HttpError("Sign in to continue.", 401);
  }
  const rows = await queryRows(
    connectionString,
    `SELECT u.id, u.email, u.display_name, u.is_admin
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  const row = rows[0];
  if (!row) {
    throw new HttpError("Sign in to continue.", 401);
  }
  const email = String(row.email ?? "").toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const id = Number(row.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError("Sign in to continue.", 401);
  }
  return {
    id,
    email,
    displayName: String(row.display_name ?? row.displayName ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin) || Boolean(adminEmail && email === adminEmail)
  };
}
function jsonError(error, options) {
  console.error(options.log, error);
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("not configured")) {
    return Response.json({ error: options.unavailable ?? options.fallback }, { status: 503 });
  }
  return Response.json({ error: options.fallback }, { status: 500 });
}
async function neonRequest(connectionString, query, params) {
  const url = new URL(connectionString);
  const response = await fetch(`https://${url.hostname}/sql`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "neon-connection-string": connectionString
    },
    body: JSON.stringify({ query, params })
  });
  const payload = await response.json().catch(() => void 0);
  if (!response.ok) {
    throw new Error(neonErrorMessage(payload, response.status));
  }
  return payload;
}
function neonErrorMessage(payload, status) {
  if (payload && typeof payload === "object" && "message" in payload) {
    return String(payload.message);
  }
  return `Neon HTTP ${status}`;
}
function isNeonRows(payload) {
  return typeof payload === "object" && payload !== null && "rows" in payload && Array.isArray(payload.rows);
}
function npgsqlToUri(connectionString) {
  const values = /* @__PURE__ */ new Map();
  for (const part of connectionString.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }
    values.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }
  const host = values.get("host");
  const user = values.get("username") ?? values.get("user");
  const password = values.get("password") ?? "";
  const database = values.get("database") ?? "HorrorTracker";
  if (!host || !user) {
    throw new HttpError("HorrorVerseDb is missing Host or Username.", 503);
  }
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgresql://${auth}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}
function toHttpDriverUrl(connectionString) {
  const normalized = connectionString.replace(/^postgres:/i, "postgresql:");
  const url = new URL(normalized);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.set("sslmode", "require");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

// api-src/people.ts
var runtime = "nodejs";
var maxDuration = 30;
async function GET(request) {
  try {
    if (socialRoute(request) === "friends") {
      return inboxResponse(request);
    }
    const connectionString = requireDatabaseUrl();
    await ensureSocialSchema(connectionString);
    const viewer = await requireUser(request, connectionString);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (Number.isInteger(id) && id > 0) {
      const person = await loadProfile(connectionString, viewer.id, id);
      if (!person) {
        throw new SocialError("That member was not found.", 400);
      }
      return Response.json({ person });
    }
    return Response.json({ people: await searchPeople(connectionString, viewer.id, url.searchParams.get("q")) });
  } catch (error) {
    return jsonError(error, { log: "People request failed.", fallback: "Could not load people." });
  }
}
async function POST(request) {
  try {
    const route = socialRoute(request);
    if (route === "friends") {
      return sendFriendRequest(request);
    }
    if (route === "follows") {
      return setFollow(request, true);
    }
    throw new SocialError("That request is not supported.", 400);
  } catch (error) {
    return jsonError(error, { log: "People request failed.", fallback: "Could not load people." });
  }
}
async function PATCH(request) {
  try {
    if (socialRoute(request) !== "friends") {
      throw new SocialError("That request is not supported.", 400);
    }
    return respondFriend(request);
  } catch (error) {
    return jsonError(error, { log: "People request failed.", fallback: "Could not load people." });
  }
}
async function DELETE(request) {
  try {
    const route = socialRoute(request);
    if (route === "friends") {
      return unfriend(request);
    }
    if (route === "follows") {
      return setFollow(request, false);
    }
    throw new SocialError("That request is not supported.", 400);
  } catch (error) {
    return jsonError(error, { log: "People request failed.", fallback: "Could not load people." });
  }
}
async function searchPeople(connectionString, viewerId, query) {
  const q = (query ?? "").trim();
  if (q.length < 2) {
    throw new SocialError("Enter at least two letters to find someone.", 400);
  }
  const rows = await queryRows(
    connectionString,
    `SELECT id, display_name, about_me, avatar
     FROM app_user
     WHERE id <> $1 AND display_name ILIKE $2
     ORDER BY lower(display_name), id
     LIMIT 20`,
    [viewerId, `%${q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`]
  );
  return Promise.all(rows.map((row) => toCard(connectionString, viewerId, row, false)));
}
async function loadProfile(connectionString, viewerId, userId) {
  const rows = await queryRows(
    connectionString,
    "SELECT id, display_name, about_me, avatar FROM app_user WHERE id = $1",
    [userId]
  );
  if (!rows[0]) {
    return null;
  }
  return toCard(connectionString, viewerId, rows[0], true);
}
async function toCard(connectionString, viewerId, row, includeActivity) {
  const id = Number(row.id);
  const relation = await relationOf(connectionString, viewerId, id);
  const following = await isFollowing(connectionString, viewerId, id);
  const canSee = viewerId === id || relation === "friends" || following;
  const aboutMe = String(row.about_me ?? row.aboutMe ?? "").trim();
  const avatar = String(row.avatar ?? "").trim();
  return {
    id,
    displayName: String(row.display_name ?? row.displayName ?? ""),
    ...aboutMe ? { aboutMe } : {},
    ...avatar ? { avatar } : {},
    friendCount: await countRows(connectionString, "SELECT COUNT(*)::int AS count FROM user_friendship WHERE user_id = $1", [id]),
    followerCount: await countRows(connectionString, "SELECT COUNT(*)::int AS count FROM user_follow WHERE following_id = $1", [id]),
    followingCount: await countRows(connectionString, "SELECT COUNT(*)::int AS count FROM user_follow WHERE follower_id = $1", [id]),
    relation,
    following,
    followedBy: await isFollowing(connectionString, id, viewerId),
    ...includeActivity && canSee ? { lists: await loadVisibleLists(connectionString, id, viewerId === id) } : {},
    ...includeActivity && canSee ? { finishedIds: await loadFinishedIds(connectionString, id) } : {}
  };
}
async function relationOf(connectionString, viewerId, otherId) {
  if (viewerId === otherId) {
    return "self";
  }
  if (await exists(connectionString, "SELECT 1 FROM user_friendship WHERE user_id = $1 AND friend_id = $2", [viewerId, otherId])) {
    return "friends";
  }
  if (await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [viewerId, otherId])) {
    return "outgoing";
  }
  if (await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [otherId, viewerId])) {
    return "incoming";
  }
  return "none";
}
async function isFollowing(connectionString, followerId, followingId) {
  if (followerId === followingId) {
    return false;
  }
  return exists(connectionString, "SELECT 1 FROM user_follow WHERE follower_id = $1 AND following_id = $2", [followerId, followingId]);
}
async function loadVisibleLists(connectionString, ownerId, includePrivate) {
  const rows = await queryRows(
    connectionString,
    includePrivate ? `SELECT l.id, l.name, l.visibility, i.media_kind, i.media_id
         FROM user_list l
         LEFT JOIN user_list_item i ON i.list_id = l.id
         WHERE l.user_id = $1
         ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id` : `SELECT l.id, l.name, l.visibility, i.media_kind, i.media_id
         FROM user_list l
         LEFT JOIN user_list_item i ON i.list_id = l.id
         WHERE l.user_id = $1 AND l.visibility = 'public'
         ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id`,
    [ownerId]
  );
  const lists = [];
  const indexById = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const id = Number(row.id);
    let index = indexById.get(id);
    if (index === void 0) {
      index = lists.length;
      indexById.set(id, index);
      lists.push({
        id,
        name: String(row.name ?? ""),
        items: [],
        visibility: String(row.visibility ?? "").trim().toLowerCase() === "public" ? "public" : "private"
      });
    }
    if (row.media_kind == null || row.media_id == null) {
      continue;
    }
    lists[index].items.push(`${String(row.media_kind)}:${Number(row.media_id)}`);
  }
  return lists;
}
async function loadFinishedIds(connectionString, userId) {
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id FROM user_media_progress WHERE user_id = $1",
    [userId]
  );
  return rows.map((row) => `${String(row.media_kind)}:${Number(row.media_id)}`);
}
async function exists(connectionString, query, params) {
  const rows = await queryRows(connectionString, query, params);
  return rows.length > 0;
}
async function countRows(connectionString, query, params) {
  const rows = await queryRows(connectionString, query, params);
  return Number(rows[0]?.count ?? 0);
}
function socialRoute(request) {
  const route = new URL(request.url).searchParams.get("route")?.trim().toLowerCase();
  if (route === "friends" || route === "follows") {
    return route;
  }
  const path = new URL(request.url).pathname.replace(/\/+$/, "").toLowerCase();
  if (path.endsWith("/friends")) {
    return "friends";
  }
  if (path.endsWith("/follows")) {
    return "follows";
  }
  return "people";
}
async function inboxResponse(request) {
  const { connectionString, viewerId } = await openSocial(request);
  return Response.json({
    friends: await loadInbox(
      connectionString,
      viewerId,
      `SELECT u.id, u.display_name, u.about_me, u.avatar
       FROM user_friendship f JOIN app_user u ON u.id = f.friend_id
       WHERE f.user_id = $1 ORDER BY lower(u.display_name), u.id`,
      "friends"
    ),
    incoming: await loadInbox(
      connectionString,
      viewerId,
      `SELECT u.id, u.display_name, u.about_me, u.avatar
       FROM user_friend_request r JOIN app_user u ON u.id = r.requester_id
       WHERE r.addressee_id = $1 ORDER BY r.created_at DESC, u.id`,
      "incoming"
    ),
    outgoing: await loadInbox(
      connectionString,
      viewerId,
      `SELECT u.id, u.display_name, u.about_me, u.avatar
       FROM user_friend_request r JOIN app_user u ON u.id = r.addressee_id
       WHERE r.requester_id = $1 ORDER BY r.created_at DESC, u.id`,
      "outgoing"
    ),
    following: await loadInbox(
      connectionString,
      viewerId,
      `SELECT u.id, u.display_name, u.about_me, u.avatar
       FROM user_follow f JOIN app_user u ON u.id = f.following_id
       WHERE f.follower_id = $1 ORDER BY lower(u.display_name), u.id`,
      "none"
    )
  });
}
async function sendFriendRequest(request) {
  const { connectionString, viewerId } = await openSocial(request);
  const body = await request.json().catch(() => ({}));
  const otherId = await requireOtherUser(connectionString, viewerId, body.userId);
  if (await exists(connectionString, "SELECT 1 FROM user_friendship WHERE user_id = $1 AND friend_id = $2", [viewerId, otherId])) {
    throw new SocialError("You are already friends.", 400);
  }
  if (await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [otherId, viewerId])) {
    await acceptRequest(connectionString, viewerId, otherId);
    return inboxResponse(request);
  }
  if (await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [viewerId, otherId])) {
    throw new SocialError("You already sent a friend request.", 400);
  }
  await execute(connectionString, "INSERT INTO user_friend_request (requester_id, addressee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    viewerId,
    otherId
  ]);
  return inboxResponse(request);
}
async function respondFriend(request) {
  const { connectionString, viewerId } = await openSocial(request);
  const body = await request.json().catch(() => ({}));
  const otherId = await requireOtherUser(connectionString, viewerId, body.userId);
  const action = String(body.action ?? "").trim().toLowerCase();
  if (action === "accept") {
    if (!await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [otherId, viewerId])) {
      throw new SocialError("That friend request is no longer waiting.", 400);
    }
    await acceptRequest(connectionString, viewerId, otherId);
    return inboxResponse(request);
  }
  if (action === "decline" || action === "cancel") {
    await execute(
      connectionString,
      `DELETE FROM user_friend_request
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [viewerId, otherId]
    );
    return inboxResponse(request);
  }
  throw new SocialError("Choose accept, decline, or cancel.", 400);
}
async function unfriend(request) {
  const { connectionString, viewerId } = await openSocial(request);
  const otherId = await requireOtherUser(connectionString, viewerId, Number(new URL(request.url).searchParams.get("id")));
  await execute(
    connectionString,
    `DELETE FROM user_friendship
     WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [viewerId, otherId]
  );
  await execute(
    connectionString,
    `DELETE FROM user_friend_request
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [viewerId, otherId]
  );
  return inboxResponse(request);
}
async function setFollow(request, follow) {
  const { connectionString, viewerId } = await openSocial(request);
  const otherId = follow ? await requireOtherUser(connectionString, viewerId, (await request.json().catch(() => ({}))).userId) : await requireOtherUser(connectionString, viewerId, Number(new URL(request.url).searchParams.get("id")));
  if (follow) {
    await execute(connectionString, "INSERT INTO user_follow (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      viewerId,
      otherId
    ]);
  } else {
    await execute(connectionString, "DELETE FROM user_follow WHERE follower_id = $1 AND following_id = $2", [viewerId, otherId]);
  }
  const person = await loadProfile(connectionString, viewerId, otherId);
  if (!person) {
    throw new SocialError("That member was not found.", 400);
  }
  return Response.json({ person });
}
async function loadInbox(connectionString, viewerId, query, relation) {
  const rows = await queryRows(connectionString, query, [viewerId]);
  return rows.map((row) => {
    const aboutMe = String(row.about_me ?? "").trim();
    const avatar = String(row.avatar ?? "").trim();
    return {
      id: Number(row.id),
      displayName: String(row.display_name ?? ""),
      ...aboutMe ? { aboutMe } : {},
      ...avatar ? { avatar } : {},
      friendCount: 0,
      followerCount: 0,
      followingCount: 0,
      relation,
      following: relation === "none",
      followedBy: false
    };
  });
}
async function acceptRequest(connectionString, viewerId, requesterId) {
  await execute(connectionString, "INSERT INTO user_friendship (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    viewerId,
    requesterId
  ]);
  await execute(connectionString, "INSERT INTO user_friendship (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    requesterId,
    viewerId
  ]);
  await execute(
    connectionString,
    `DELETE FROM user_friend_request
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [viewerId, requesterId]
  );
}
async function requireOtherUser(connectionString, viewerId, userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1 || id === viewerId) {
    throw new SocialError(id === viewerId ? "That has to be someone else." : "That member was not found.", 400);
  }
  if (!await exists(connectionString, "SELECT 1 FROM app_user WHERE id = $1", [id])) {
    throw new SocialError("That member was not found.", 400);
  }
  return id;
}
async function openSocial(request) {
  const connectionString = requireDatabaseUrl();
  await ensureSocialSchema(connectionString);
  const viewer = await requireUser(request, connectionString);
  return { connectionString, viewerId: viewer.id };
}
async function ensureSocialSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS about_me TEXT");
  await execute(connectionString, "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar TEXT");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_friend_request (
      requester_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      addressee_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (requester_id, addressee_id),
      CHECK (requester_id <> addressee_id)
    )`
  );
  try {
    await execute(
      connectionString,
      `CREATE UNIQUE INDEX IF NOT EXISTS user_friend_request_pair_idx
       ON user_friend_request (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))`
    );
  } catch {
  }
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_friendship (
      user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id),
      CHECK (user_id <> friend_id)
    )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_follow (
      follower_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id),
      CHECK (follower_id <> following_id)
    )`
  );
  await execute(connectionString, "ALTER TABLE user_list ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'");
}
function requireUser(request, connectionString) {
  return requireSessionUser(request, connectionString);
}
var SocialError = class extends HttpError {
};
export {
  DELETE,
  GET,
  PATCH,
  POST,
  ensureSocialSchema,
  maxDuration,
  runtime
};
