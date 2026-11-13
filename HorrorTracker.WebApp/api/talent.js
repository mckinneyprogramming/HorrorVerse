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
async function tmdbJson(path) {
  const payload = await tmdbJsonOptional(path);
  if (!payload) {
    throw new HttpError("Could not reach TMDb.", 502);
  }
  return payload;
}
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
function asResults(payload) {
  return Array.isArray(payload.results) ? payload.results.filter((item) => item && typeof item === "object") : [];
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

// lib/follow-upcoming.ts
var FOLLOW_UPCOMING_LIMIT = 8;
function matchFollowUpcoming(credits, schedule, limit = FOLLOW_UPCOMING_LIMIT) {
  const byMovie = /* @__PURE__ */ new Map();
  const byShow = /* @__PURE__ */ new Map();
  for (const credit of credits) {
    if (!credit.personId || !credit.personName || !credit.tmdbId) {
      continue;
    }
    const bucket = credit.mediaType === "tv" ? byShow : byMovie;
    if (!bucket.has(credit.tmdbId)) {
      bucket.set(credit.tmdbId, credit);
    }
  }
  const matched = [];
  const seen = /* @__PURE__ */ new Set();
  for (const title of [...schedule.films, ...schedule.shows]) {
    if (!title.tmdbId || !title.title || !/^\d{4}-\d{2}-\d{2}$/.test(title.releaseDate)) {
      continue;
    }
    const credit = title.kind === "film" ? byMovie.get(title.tmdbId) : byShow.get(title.tmdbId);
    if (!credit) {
      continue;
    }
    const key = `${title.kind}:${title.tmdbId}:${title.releaseDate}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const posterPath = title.posterPath ?? credit.posterPath;
    const role = credit.role.trim();
    matched.push({
      tmdbId: title.tmdbId,
      kind: title.kind,
      title: title.title,
      releaseDate: title.releaseDate,
      ...title.detail ? { detail: title.detail } : {},
      ...posterPath ? { posterPath } : {},
      personId: credit.personId,
      personName: credit.personName,
      ...role ? { role } : {}
    });
  }
  return matched.sort((left, right) => left.releaseDate.localeCompare(right.releaseDate) || left.title.localeCompare(right.title)).slice(0, Math.max(0, limit));
}
async function loadFollowCredits(connectionString, userId) {
  const rows = await queryRows(
    connectionString,
    `SELECT f.person_id, f.name, t.tmdb_id, t.media_type, t.role, t.poster_path
     FROM user_talent_follow f
     JOIN talent_filmography t ON t.person_id = f.person_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC, t.title`,
    [userId]
  );
  const credits = [];
  for (const row of rows) {
    const personId = asId(row, "person_id");
    const personName = String(row.name ?? "").trim();
    const tmdbId = asPositiveInt(row.tmdb_id);
    const mediaType = row.media_type === "tv" || row.media_type === "movie" ? row.media_type : void 0;
    if (!personId || !personName || !tmdbId || !mediaType) {
      continue;
    }
    const posterPath = parsePosterPath(row.poster_path);
    credits.push({
      personId,
      personName,
      tmdbId,
      mediaType,
      role: String(row.role ?? "").trim() || "Cast",
      ...posterPath ? { posterPath } : {}
    });
  }
  return credits;
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
async function listFollowUpcoming(connectionString, userId, schedule) {
  await ensureTalentSchema(connectionString);
  const credits = await loadFollowCredits(connectionString, userId);
  return matchFollowUpcoming(credits, schedule);
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

// api-src/upcoming.ts
var HORROR_GENRE2 = 27;
var HORROR_KEYWORD = 3158;
var EXCLUDED_TV_GENRES = /* @__PURE__ */ new Set([35, 10762, 10763, 10764, 10766, 10767]);
var HORROR_KEYWORD_HINTS = ["horror", "slasher", "supernatural", "ghost", "zombie", "vampire", "haunted", "demonic", "occult"];
var HORIZON_YEARS = 2;
var EPISODE_HORIZON_DAYS = 90;
var MAX_PAGES = 12;
var MAX_EPISODE_PAGES = 3;
var MAX_TV_DETAILS = 48;
var CACHE_MS = 6 * 60 * 60 * 1e3;
var cache = null;
async function loadUpcomingSchedule() {
  return loadSchedule();
}
async function loadSchedule() {
  if (cache && cache.expires > Date.now()) {
    return cache;
  }
  const films = await loadFilms();
  const shows = await loadShows().catch(() => []);
  cache = { expires: Date.now() + CACHE_MS, films, shows };
  return cache;
}
async function loadFilms() {
  const today = utcToday();
  const until = addYears(today, HORIZON_YEARS);
  const start = isoDate(today);
  const end = isoDate(until);
  const films = [];
  const seen = /* @__PURE__ */ new Set();
  let pages = 1;
  for (let page = 1; page <= pages && page <= MAX_PAGES; page += 1) {
    const payload = await tmdbJson(
      `/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=primary_release_date.asc&with_genres=${HORROR_GENRE2}&primary_release_date.gte=${encodeURIComponent(start)}&primary_release_date.lte=${encodeURIComponent(end)}`
    );
    pages = pageCount(payload, MAX_PAGES);
    for (const item of asResults(payload)) {
      const tmdbId = Number(item.id);
      const title = String(item.title ?? "").trim();
      const releaseDate = String(item.release_date ?? "").trim();
      if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title || !releaseDate || seen.has(tmdbId)) {
        continue;
      }
      const date = parseDate(releaseDate);
      if (!date || date < today || date > until) {
        continue;
      }
      seen.add(tmdbId);
      const overview = trimOverview(String(item.overview ?? "").trim());
      const posterPath = parsePosterPath(item.poster_path);
      films.push({
        kind: "film",
        tmdbId,
        title,
        releaseDate: isoDate(date),
        year: date.getUTCFullYear(),
        ...overview ? { overview } : {},
        ...posterPath ? { posterPath } : {}
      });
    }
  }
  return sortTitles(films);
}
async function loadShows() {
  const today = utcToday();
  const until = addYears(today, HORIZON_YEARS);
  const [premieres, episodeIds] = await Promise.all([loadShowPremieres(today, until), collectEpisodeShowIds(today)]);
  const episodes = await loadNextEpisodes(episodeIds, today, until);
  const premiereDates = new Set(episodes.map((item) => `${item.tmdbId}:${item.releaseDate}`));
  return sortTitles(premieres.filter((item) => !premiereDates.has(`${item.tmdbId}:${item.releaseDate}`)).concat(episodes));
}
async function loadShowPremieres(today, until) {
  const start = isoDate(today);
  const end = isoDate(until);
  const shows = [];
  const seen = /* @__PURE__ */ new Set();
  let pages = 1;
  for (let page = 1; page <= pages && page <= MAX_PAGES; page += 1) {
    const payload = await tmdbJson(
      `/discover/tv?include_adult=false&language=en-US&page=${page}&sort_by=first_air_date.asc&first_air_date.gte=${encodeURIComponent(start)}&first_air_date.lte=${encodeURIComponent(end)}`
    );
    pages = pageCount(payload, MAX_PAGES);
    for (const item of asResults(payload)) {
      const tmdbId = Number(item.id);
      const title = String(item.name ?? "").trim();
      const releaseDate = String(item.first_air_date ?? "").trim();
      if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title || !releaseDate || seen.has(tmdbId) || !looksLikeHorrorTv(item)) {
        continue;
      }
      const date = parseDate(releaseDate);
      if (!date || date < today || date > until) {
        continue;
      }
      seen.add(tmdbId);
      const overview = trimOverview(String(item.overview ?? "").trim());
      const posterPath = parsePosterPath(item.poster_path);
      shows.push({
        kind: "show",
        tmdbId,
        title,
        releaseDate: isoDate(date),
        year: date.getUTCFullYear(),
        detail: "New series",
        ...overview ? { overview } : {},
        ...posterPath ? { posterPath } : {}
      });
    }
  }
  return shows;
}
async function collectEpisodeShowIds(today) {
  const until = addDays(today, EPISODE_HORIZON_DAYS);
  const ids = /* @__PURE__ */ new Set();
  await collectIds(
    `/discover/tv?include_adult=false&language=en-US&air_date.gte=${encodeURIComponent(isoDate(today))}&air_date.lte=${encodeURIComponent(isoDate(until))}`,
    MAX_EPISODE_PAGES,
    ids,
    true
  );
  await collectIds("/tv/airing_today?language=en-US", 2, ids, true);
  await collectIds("/tv/on_the_air?language=en-US", 2, ids, true);
  return [...ids];
}
async function collectIds(path, maxPages, ids, requireHorror) {
  let pages = 1;
  for (let page = 1; page <= pages && page <= maxPages && ids.size < MAX_TV_DETAILS; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const payload = await tmdbJsonOptional(`${path}${separator}page=${page}`);
    if (!payload) {
      break;
    }
    pages = pageCount(payload, maxPages);
    for (const item of asResults(payload)) {
      if (requireHorror && !looksLikeHorrorTv(item)) {
        continue;
      }
      const tmdbId = Number(item.id);
      if (Number.isInteger(tmdbId) && tmdbId > 0) {
        ids.add(tmdbId);
      }
    }
  }
}
async function loadNextEpisodes(showIds, today, until) {
  const ids = [...new Set(showIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_TV_DETAILS);
  const documents = await Promise.all(ids.map((id) => tmdbJsonOptional(`/tv/${id}?language=en-US&append_to_response=keywords`)));
  const episodes = [];
  documents.forEach((payload, index) => {
    if (!payload || !isHorrorTvShow(payload)) {
      return;
    }
    const next = asObject(payload.next_episode_to_air);
    const showTitle = String(payload.name ?? "").trim();
    const airDate = String(next?.air_date ?? "").trim();
    const date = parseDate(airDate);
    if (!showTitle || !date || date < today || date > until) {
      return;
    }
    const season = Number(next?.season_number);
    const episode = Number(next?.episode_number);
    const episodeName = String(next?.name ?? "").trim();
    const overview = trimOverview(String(next?.overview ?? "").trim()) || trimOverview(String(payload.overview ?? "").trim());
    const detail = formatEpisodeDetail(season, episode, episodeName);
    const posterPath = parsePosterPath(payload.poster_path);
    episodes.push({
      kind: "episode",
      tmdbId: ids[index],
      title: showTitle,
      releaseDate: isoDate(date),
      year: date.getUTCFullYear(),
      ...overview ? { overview } : {},
      ...detail ? { detail } : {},
      ...posterPath ? { posterPath } : {}
    });
  });
  return episodes;
}
function formatEpisodeDetail(season, episode, name) {
  const code = Number.isInteger(season) && season > 0 && Number.isInteger(episode) && episode > 0 ? `S${season} E${episode}` : "";
  if (code && name) {
    return `${code} \xB7 ${name}`;
  }
  return code || name || void 0;
}
function utcToday() {
  const today = /* @__PURE__ */ new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}
function addYears(date, years) {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}
function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function asObject(value) {
  return value && typeof value === "object" ? value : void 0;
}
function pageCount(payload, maxPages) {
  return Math.min(Math.max(Number(payload.total_pages) || 1, 1), maxPages);
}
function looksLikeHorrorTv(item) {
  if (hasExcludedTvGenreIds(item)) {
    return false;
  }
  const text = `${item.name ?? ""} ${item.overview ?? ""}`.toLowerCase();
  return HORROR_KEYWORD_HINTS.some((hint) => text.includes(hint));
}
function isHorrorTvShow(payload) {
  if (hasExcludedTvGenresObject(payload)) {
    return false;
  }
  return hasHorrorKeyword(payload) || looksLikeHorrorTv(payload);
}
function hasHorrorKeyword(payload) {
  const keywords = asObject(payload.keywords);
  const list = Array.isArray(keywords?.results) ? keywords.results : Array.isArray(keywords?.keywords) ? keywords.keywords : [];
  return list.some((value) => {
    if (!value || typeof value !== "object") {
      return false;
    }
    const item = value;
    const name = String(item.name ?? "").toLowerCase();
    return Number(item.id) === HORROR_KEYWORD || HORROR_KEYWORD_HINTS.some((hint) => name.includes(hint));
  });
}
function hasExcludedTvGenreIds(item) {
  return Array.isArray(item.genre_ids) && item.genre_ids.some((value) => EXCLUDED_TV_GENRES.has(Number(value)));
}
function hasExcludedTvGenresObject(payload) {
  return Array.isArray(payload.genres) && payload.genres.some((item) => item && typeof item === "object" && EXCLUDED_TV_GENRES.has(Number(item.id)));
}
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return void 0;
  }
  const date = /* @__PURE__ */ new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
function trimOverview(overview) {
  if (!overview) {
    return "";
  }
  return overview.length <= 400 ? overview : `${overview.slice(0, 397).trimEnd()}\u2026`;
}
function sortTitles(items) {
  return items.sort((left, right) => left.releaseDate.localeCompare(right.releaseDate) || left.title.localeCompare(right.title));
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
    if (url.searchParams.get("upcoming") === "1") {
      const schedule = await loadUpcomingSchedule();
      return Response.json({ titles: await listFollowUpcoming(connectionString, user.id, schedule) });
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
