export const runtime = "nodejs";
export const maxDuration = 30;

interface WriteBody {
  userId?: number;
  action?: string;
}

export async function GET(request: Request) {
  try {
    const { connectionString, viewerId } = await openSocial(request);
    return Response.json({
      friends: await loadPeople(
        connectionString,
        viewerId,
        `SELECT u.id, u.display_name, u.about_me, u.avatar
         FROM user_friendship f JOIN app_user u ON u.id = f.friend_id
         WHERE f.user_id = $1 ORDER BY lower(u.display_name), u.id`,
        "friends",
      ),
      incoming: await loadPeople(
        connectionString,
        viewerId,
        `SELECT u.id, u.display_name, u.about_me, u.avatar
         FROM user_friend_request r JOIN app_user u ON u.id = r.requester_id
         WHERE r.addressee_id = $1 ORDER BY r.created_at DESC, u.id`,
        "incoming",
      ),
      outgoing: await loadPeople(
        connectionString,
        viewerId,
        `SELECT u.id, u.display_name, u.about_me, u.avatar
         FROM user_friend_request r JOIN app_user u ON u.id = r.addressee_id
         WHERE r.requester_id = $1 ORDER BY r.created_at DESC, u.id`,
        "outgoing",
      ),
      following: await loadPeople(
        connectionString,
        viewerId,
        `SELECT u.id, u.display_name, u.about_me, u.avatar
         FROM user_follow f JOIN app_user u ON u.id = f.following_id
         WHERE f.follower_id = $1 ORDER BY lower(u.display_name), u.id`,
        "none",
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { connectionString, viewerId } = await openSocial(request);
    const body = (await request.json().catch(() => ({}))) as WriteBody;
    const otherId = await requireOtherUser(connectionString, viewerId, body.userId);
    if (await exists(connectionString, "SELECT 1 FROM user_friendship WHERE user_id = $1 AND friend_id = $2", [viewerId, otherId])) {
      throw new SocialError("You are already friends.", 400);
    }

    if (await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [otherId, viewerId])) {
      await acceptRequest(connectionString, viewerId, otherId);
      return GET(request);
    }

    if (await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [viewerId, otherId])) {
      throw new SocialError("You already sent a friend request.", 400);
    }

    await execute(connectionString, "INSERT INTO user_friend_request (requester_id, addressee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      viewerId,
      otherId,
    ]);
    return GET(request);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { connectionString, viewerId } = await openSocial(request);
    const body = (await request.json().catch(() => ({}))) as WriteBody;
    const otherId = await requireOtherUser(connectionString, viewerId, body.userId);
    const action = String(body.action ?? "").trim().toLowerCase();
    if (action === "accept") {
      if (!(await exists(connectionString, "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2", [otherId, viewerId]))) {
        throw new SocialError("That friend request is no longer waiting.", 400);
      }

      await acceptRequest(connectionString, viewerId, otherId);
      return GET(request);
    }

    if (action === "decline" || action === "cancel") {
      await execute(
        connectionString,
        `DELETE FROM user_friend_request
         WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
        [viewerId, otherId],
      );
      return GET(request);
    }

    throw new SocialError("Choose accept, decline, or cancel.", 400);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { connectionString, viewerId } = await openSocial(request);
    const otherId = await requireOtherUser(connectionString, viewerId, Number(new URL(request.url).searchParams.get("id")));
    await execute(
      connectionString,
      `DELETE FROM user_friendship
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [viewerId, otherId],
    );
    await execute(
      connectionString,
      `DELETE FROM user_friend_request
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [viewerId, otherId],
    );
    return GET(request);
  } catch (error) {
    return jsonError(error);
  }
}

async function acceptRequest(connectionString: string, viewerId: number, requesterId: number): Promise<void> {
  await execute(connectionString, "INSERT INTO user_friendship (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    viewerId,
    requesterId,
  ]);
  await execute(connectionString, "INSERT INTO user_friendship (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    requesterId,
    viewerId,
  ]);
  await execute(
    connectionString,
    `DELETE FROM user_friend_request
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [viewerId, requesterId],
  );
}

async function loadPeople(connectionString: string, viewerId: number, query: string, relation: string) {
  const rows = await queryRows(connectionString, query, [viewerId]);
  return rows.map((row) => {
    const aboutMe = String(row.about_me ?? "").trim();
    const avatar = String(row.avatar ?? "").trim();
    return {
      id: Number(row.id),
      displayName: String(row.display_name ?? ""),
      ...(aboutMe ? { aboutMe } : {}),
      ...(avatar ? { avatar } : {}),
      friendCount: 0,
      followerCount: 0,
      followingCount: 0,
      relation,
      following: relation === "none",
      followedBy: false,
    };
  });
}

async function requireOtherUser(connectionString: string, viewerId: number, userId: number | undefined): Promise<number> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1 || id === viewerId) {
    throw new SocialError(id === viewerId ? "That has to be someone else." : "That member was not found.", 400);
  }

  if (!(await exists(connectionString, "SELECT 1 FROM app_user WHERE id = $1", [id]))) {
    throw new SocialError("That member was not found.", 400);
  }

  return id;
}

async function openSocial(request: Request): Promise<{ connectionString: string; viewerId: number }> {
  const connectionString = requireDatabaseUrl();
  await ensureSchema(connectionString);
  const token = readSessionToken(request);
  if (!token) {
    throw new SocialError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    "SELECT u.id FROM app_session s JOIN app_user u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW()",
    [token],
  );
  const viewerId = Number(rows[0]?.id);
  if (!Number.isInteger(viewerId) || viewerId < 1) {
    throw new SocialError("Sign in to continue.", 401);
  }

  return { connectionString, viewerId };
}

async function ensureSchema(connectionString: string): Promise<void> {
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
    )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_friendship (
      user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id),
      CHECK (user_id <> friend_id)
    )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_follow (
      follower_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id),
      CHECK (follower_id <> following_id)
    )`,
  );
}

async function exists(connectionString: string, query: string, params: unknown[]): Promise<boolean> {
  return (await queryRows(connectionString, query, params)).length > 0;
}

function readSessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }

    if (part.slice(0, separator).trim() === "hv_session") {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new SocialError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
}

async function queryRows(connectionString: string, query: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const payload = await neonRequest(connectionString, query, params);
  if (!payload || typeof payload !== "object" || !("rows" in payload) || !Array.isArray((payload as { rows: unknown }).rows)) {
    throw new Error("Neon HTTP response did not include rows.");
  }

  return (payload as { rows: Record<string, unknown>[] }).rows;
}

async function execute(connectionString: string, query: string, params: unknown[] = []): Promise<void> {
  await neonRequest(connectionString, query, params);
}

async function neonRequest(connectionString: string, query: string, params: unknown[]): Promise<unknown> {
  const url = new URL(connectionString);
  const response = await fetch(`https://${url.hostname}/sql`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "neon-connection-string": connectionString,
    },
    body: JSON.stringify({ query, params }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "message" in payload ? String((payload as { message: unknown }).message) : `Neon HTTP ${response.status}`);
  }

  return payload;
}

function jsonError(error: unknown): Response {
  if (error instanceof SocialError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: error instanceof Error ? error.message : "Could not update friends." }, { status: 500 });
}

class SocialError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
