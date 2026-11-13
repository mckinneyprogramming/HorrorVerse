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

// lib/tmdb.ts
var TMDB_BASE = "https://api.themoviedb.org/3";
async function tmdbJsonOptional(path) {
  const apiKey = process.env.TMDBKey?.trim();
  if (!apiKey) {
    throw new HttpError("TMDBKey is not configured.", 503);
  }
  try {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        throw new HttpError("Could not reach TMDb.", 503);
      }
      return null;
    }
    return payload;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    return null;
  }
}
function asId(row, key = "id") {
  return asPositiveInt(row?.[key]);
}
function asPositiveInt(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : void 0;
}
function yearFrom(value) {
  const text = String(value ?? "");
  const year = Number(text.slice(0, 4));
  return Number.isInteger(year) && year >= 1888 && year <= 3e3 ? year : void 0;
}

// lib/poster.ts
var MAX_POSTER_BYTES = 8 * 1024 * 1024;
function parsePosterPath(value) {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.length > 160 || path.includes("..") || /[^A-Za-z0-9._/-]/.test(path)) {
    return void 0;
  }
  return path;
}

// lib/talent.ts
var HORROR_GENRE = 27;
var DOCUMENTARY_GENRE = 99;
var CAST_LIMIT = 8;
var DIRECTOR_LIMIT = 4;
var FILMOGRAPHY_LIMIT = 120;
function selectTitleCredits(payload) {
  const directors = [];
  const seenDirectors = /* @__PURE__ */ new Set();
  for (const item of records(payload.crew)) {
    if (directors.length >= DIRECTOR_LIMIT) {
      break;
    }
    if (String(item.job ?? "").trim().toLowerCase() !== "director") {
      continue;
    }
    const person = readName(item, "Director");
    if (!person || seenDirectors.has(person.id)) {
      continue;
    }
    seenDirectors.add(person.id);
    directors.push(person);
  }
  const cast = [];
  const seenCast = /* @__PURE__ */ new Set();
  const ranked = records(payload.cast).map((item, index) => ({ item, index, order: billingOrder(item) })).sort((left, right) => left.order - right.order || left.index - right.index);
  for (const { item } of ranked) {
    if (cast.length >= CAST_LIMIT) {
      break;
    }
    const character = clip(item.character, 80);
    const person = readName(item, character || "Cast");
    if (!person || seenCast.has(person.id)) {
      continue;
    }
    seenCast.add(person.id);
    cast.push(person);
  }
  return { directors, cast };
}
function selectFilmography(payload) {
  const combined = record(payload.combined_credits) ?? {};
  const credits = /* @__PURE__ */ new Map();
  for (const item of records(combined.cast)) {
    rememberCredit(credits, item, clip(item.character, 80) || "Cast");
  }
  for (const item of records(combined.crew)) {
    if (String(item.job ?? "").trim().toLowerCase() !== "director") {
      continue;
    }
    rememberCredit(credits, item, "Director");
  }
  const knownFor = clip(payload.known_for_department, 40);
  const profilePath = parsePosterPath(payload.profile_path);
  return {
    name: clip(payload.name, 200) ?? "",
    ...profilePath ? { profilePath } : {},
    ...knownFor ? { knownFor } : {},
    credits: [...credits.values()].map((credit) => ({ credit, year: credit.year ?? 0 })).sort((left, right) => right.year - left.year || left.credit.title.localeCompare(right.credit.title)).map((item) => item.credit).slice(0, FILMOGRAPHY_LIMIT)
  };
}
async function titleCredits(connectionString, titleId) {
  await ensureTalentSchema(connectionString);
  const parsed = parseVaultTitle(titleId);
  if (!parsed) {
    return { directors: [], cast: [] };
  }
  const tmdbId = await lookupTmdbId(connectionString, parsed.kind, parsed.mediaId);
  if (!tmdbId) {
    return { directors: [], cast: [] };
  }
  const path = parsed.kind === "show" ? `/tv/${tmdbId}/credits` : `/movie/${tmdbId}/credits`;
  const payload = await tmdbJsonOptional(path);
  return selectTitleCredits(payload ?? {});
}
async function openTalent(connectionString, userId, personId) {
  const person = await loadPerson(connectionString, userId, personId);
  if (!person) {
    throw new HttpError("That person was not found.", 404);
  }
  return person;
}
async function listFollowedTalent(connectionString, userId) {
  await ensureTalentSchema(connectionString);
  const follows = await queryRows(
    connectionString,
    `SELECT person_id, name, profile_path, known_for
     FROM user_talent_follow
     WHERE user_id = $1
     ORDER BY created_at DESC, person_id`,
    [userId]
  );
  const people = [];
  for (const row of follows) {
    const id = asId(row, "person_id");
    const name = clip(row.name, 200);
    if (!id || !name) {
      continue;
    }
    const profilePath = parsePosterPath(row.profile_path);
    const knownFor = clip(row.known_for, 40);
    const stored = await readCachedCredits(connectionString, id);
    const filled = stored.length > 0 ? await annotateCredits(connectionString, userId, stored) : (await loadPerson(connectionString, userId, id))?.credits ?? [];
    const watched = filled.filter((credit) => credit.finished).length;
    people.push({
      id,
      name,
      ...profilePath ? { profilePath } : {},
      ...knownFor ? { knownFor } : {},
      watched,
      total: filled.length
    });
  }
  return people;
}
async function followTalent(connectionString, userId, personId) {
  const person = await openTalent(connectionString, userId, personId);
  await execute(
    connectionString,
    `INSERT INTO user_talent_follow (user_id, person_id, name, profile_path, known_for)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, person_id) DO UPDATE
     SET name = EXCLUDED.name, profile_path = EXCLUDED.profile_path, known_for = EXCLUDED.known_for`,
    [userId, person.id, person.name, person.profilePath ?? null, person.knownFor ?? null]
  );
  return { ...person, following: true };
}
async function unfollowTalent(connectionString, userId, personId) {
  requirePersonId(personId);
  await ensureTalentSchema(connectionString);
  await execute(connectionString, "DELETE FROM user_talent_follow WHERE user_id = $1 AND person_id = $2", [userId, personId]);
  try {
    const person = await openTalent(connectionString, userId, personId);
    return { ...person, following: false };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { id: personId, name: "Unknown", following: false, watched: 0, total: 0, credits: [] };
    }
    throw error;
  }
}
async function loadPerson(connectionString, userId, personId) {
  requirePersonId(personId);
  await ensureTalentSchema(connectionString);
  const payload = await tmdbJsonOptional(`/person/${personId}?append_to_response=combined_credits`);
  if (!payload) {
    return void 0;
  }
  const selected = selectFilmography(payload);
  if (!selected.name) {
    return void 0;
  }
  await replaceCredits(connectionString, personId, selected.credits);
  const [annotated, following] = await Promise.all([
    annotateCredits(connectionString, userId, selected.credits),
    isFollowing(connectionString, userId, personId)
  ]);
  return {
    id: personId,
    name: selected.name,
    ...selected.profilePath ? { profilePath: selected.profilePath } : {},
    ...selected.knownFor ? { knownFor: selected.knownFor } : {},
    following,
    watched: annotated.filter((credit) => credit.finished).length,
    total: annotated.length,
    credits: annotated
  };
}
async function readCachedCredits(connectionString, personId) {
  const rows = await queryRows(
    connectionString,
    `SELECT media_type, tmdb_id, title, release_year, poster_path, role, kind
     FROM talent_filmography
     WHERE person_id = $1`,
    [personId]
  );
  const credits = [];
  for (const row of rows) {
    const credit = readStoredCredit(row);
    if (credit) {
      credits.push(credit);
    }
  }
  return credits;
}
async function annotateCredits(connectionString, userId, credits) {
  const vault = await vaultByTmdb(connectionString);
  const finished = await finishedIds(connectionString, userId);
  return credits.map((credit) => {
    const matches = vault.get(`${credit.kind}:${credit.tmdbId}`);
    let vaultId;
    if (matches) {
      vaultId = matches.find((id) => finished.has(id)) ?? matches[0];
    }
    return {
      ...credit,
      ...vaultId ? { vaultId } : {},
      finished: Boolean(vaultId && finished.has(vaultId))
    };
  });
}
async function vaultByTmdb(connectionString) {
  const rows = await queryRows(
    connectionString,
    `SELECT 'movie' AS kind, id, tmdbid FROM movie WHERE tmdbid IS NOT NULL
     UNION ALL
     SELECT 'documentary', id, tmdbid FROM documentary WHERE tmdbid IS NOT NULL
     UNION ALL
     SELECT 'show', id, tmdbid FROM show WHERE tmdbid IS NOT NULL`
  );
  const vault = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const kind = String(row.kind ?? "");
    const id = asId(row);
    const tmdbId = asId(row, "tmdbid");
    if ((kind === "movie" || kind === "documentary" || kind === "show") && id && tmdbId) {
      const key = `${kind}:${tmdbId}`;
      const ids = vault.get(key) ?? [];
      ids.push(`${kind}:${id}`);
      vault.set(key, ids);
    }
  }
  return vault;
}
async function finishedIds(connectionString, userId) {
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id FROM user_media_progress WHERE user_id = $1",
    [userId]
  );
  const ids = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const kind = String(row.media_kind ?? "");
    const id = asId(row, "media_id");
    if (kind && id) {
      ids.add(`${kind}:${id}`);
    }
  }
  return ids;
}
async function isFollowing(connectionString, userId, personId) {
  const rows = await queryRows(
    connectionString,
    "SELECT 1 FROM user_talent_follow WHERE user_id = $1 AND person_id = $2",
    [userId, personId]
  );
  return rows.length > 0;
}
async function lookupTmdbId(connectionString, kind, mediaId) {
  const table = kind === "movie" ? "movie" : kind === "documentary" ? "documentary" : "show";
  const rows = await queryRows(connectionString, `SELECT tmdbid FROM ${table} WHERE id = $1`, [mediaId]);
  return asId(rows[0], "tmdbid");
}
async function replaceCredits(connectionString, personId, credits) {
  await execute(connectionString, "DELETE FROM talent_filmography WHERE person_id = $1", [personId]);
  if (credits.length < 1) {
    return;
  }
  const values = [];
  const params = [];
  credits.forEach((credit, index) => {
    const base = index * 8;
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, NOW())`
    );
    params.push(
      personId,
      credit.mediaType,
      credit.tmdbId,
      credit.title,
      credit.year ?? null,
      credit.posterPath ?? null,
      credit.role,
      credit.kind
    );
  });
  await execute(
    connectionString,
    `INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, release_year, poster_path, role, kind, refreshed_at)
     VALUES ${values.join(", ")}`,
    params
  );
}
var talentSchema;
var talentSchemaKey = "";
async function ensureTalentSchema(connectionString) {
  if (talentSchema && talentSchemaKey === connectionString) {
    return talentSchema;
  }
  talentSchemaKey = connectionString;
  talentSchema = createTalentSchema(connectionString).catch((error) => {
    talentSchema = void 0;
    talentSchemaKey = "";
    throw error;
  });
  return talentSchema;
}
async function createTalentSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_talent_follow (
        user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        profile_path TEXT,
        known_for TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, person_id)
      )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS talent_filmography (
        person_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        release_year INTEGER,
        poster_path TEXT,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (person_id, media_type, tmdb_id)
      )`
  );
}
function rememberCredit(credits, item, role) {
  const mediaType = item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : void 0;
  const tmdbId = asPositiveInt(item.id);
  const title = clip(item.title ?? item.name, 200);
  if (!mediaType || !tmdbId || !title || !hasGenre(item, HORROR_GENRE)) {
    return;
  }
  const key = `${mediaType}:${tmdbId}`;
  const existing = credits.get(key);
  const posterPath = parsePosterPath(item.poster_path);
  const year = yearFrom(item.release_date ?? item.first_air_date);
  const kind = mediaType === "tv" ? "show" : hasGenre(item, DOCUMENTARY_GENRE) ? "documentary" : "movie";
  if (!existing) {
    credits.set(key, {
      tmdbId,
      mediaType,
      kind,
      title,
      ...year ? { year } : {},
      ...posterPath ? { posterPath } : {},
      role
    });
    return;
  }
  existing.role = mergeRole(existing.role, role);
  if (!existing.posterPath && posterPath) {
    existing.posterPath = posterPath;
  }
  if (!existing.year && year) {
    existing.year = year;
  }
}
function readStoredCredit(row) {
  const mediaType = row.media_type === "tv" ? "tv" : row.media_type === "movie" ? "movie" : void 0;
  const tmdbId = asId(row, "tmdb_id");
  const title = clip(row.title, 200);
  const kind = row.kind === "show" || row.kind === "documentary" || row.kind === "movie" ? row.kind : void 0;
  const role = clip(row.role, 120);
  if (!mediaType || !tmdbId || !title || !kind || !role) {
    return void 0;
  }
  const year = asPositiveInt(row.release_year);
  const posterPath = parsePosterPath(row.poster_path);
  return {
    tmdbId,
    mediaType,
    kind,
    title,
    ...year ? { year } : {},
    ...posterPath ? { posterPath } : {},
    role
  };
}
function readName(item, role) {
  const id = asPositiveInt(item.id);
  const name = clip(item.name, 200);
  if (!id || !name) {
    return void 0;
  }
  const profilePath = parsePosterPath(item.profile_path);
  return { id, name, role, ...profilePath ? { profilePath } : {} };
}
function mergeRole(current, next) {
  if (current === next || current.split(" \xB7 ").includes(next)) {
    return current;
  }
  if (current === "Cast") {
    return next;
  }
  if (next === "Cast") {
    return current;
  }
  return `${current} \xB7 ${next}`;
}
function billingOrder(item) {
  const order = Number(item.order);
  return Number.isInteger(order) && order >= 0 ? order : 1e4;
}
function hasGenre(item, genreId) {
  return Array.isArray(item.genre_ids) && item.genre_ids.some((id) => Number(id) === genreId);
}
function records(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => Boolean(item) && typeof item === "object");
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function clip(value, max) {
  const text = String(value ?? "").trim();
  if (!text) {
    return void 0;
  }
  return text.length <= max ? text : text.slice(0, max).trimEnd();
}
function parseVaultTitle(titleId) {
  const match = /^(movie|documentary|show):(\d+)$/.exec(titleId);
  const mediaId = Number(match?.[2]);
  if (!match || !Number.isInteger(mediaId) || mediaId < 1) {
    return void 0;
  }
  return { kind: match[1], mediaId };
}
function requirePersonId(personId) {
  if (!Number.isInteger(personId) || personId < 1) {
    throw new HttpError("Choose a person to open.", 400);
  }
}

// api-src/talent.ts
var runtime = "nodejs";
var maxDuration = 30;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    const url = new URL(request.url);
    const title = url.searchParams.get("title");
    if (title) {
      return Response.json(await titleCredits(connectionString, title));
    }
    const person = Number(url.searchParams.get("person"));
    if (url.searchParams.has("person")) {
      return Response.json({ person: await openTalent(connectionString, user.id, person) });
    }
    return Response.json({ people: await listFollowedTalent(connectionString, user.id) });
  } catch (error) {
    return jsonError(error, { log: "Talent request failed.", fallback: "Could not load that filmography." });
  }
}
async function POST(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    const body = await request.json().catch(() => ({}));
    return Response.json({ person: await followTalent(connectionString, user.id, Number(body.personId)) });
  } catch (error) {
    return jsonError(error, { log: "Talent request failed.", fallback: "Could not follow that person." });
  }
}
async function DELETE(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    const person = Number(new URL(request.url).searchParams.get("person"));
    if (!new URL(request.url).searchParams.has("person")) {
      throw new HttpError("Choose a person to open.", 400);
    }
    return Response.json({ person: await unfollowTalent(connectionString, user.id, person) });
  } catch (error) {
    return jsonError(error, { log: "Talent request failed.", fallback: "Could not unfollow that person." });
  }
}
export {
  DELETE,
  GET,
  POST,
  maxDuration,
  runtime
};
