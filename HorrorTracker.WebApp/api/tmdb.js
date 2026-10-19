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
function asRecord(value) {
  return value && typeof value === "object" ? value : void 0;
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
function runtimeOf(value) {
  const runtime2 = Number(value);
  return Number.isFinite(runtime2) && runtime2 > 0 ? runtime2 : 0;
}
function showTotalMinutes(show, fallbackEpisodeMinutes = 0) {
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const episodeMinutes = episodeLengthMinutes(show) || fallbackEpisodeMinutes;
  return episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
}
function episodeLengthMinutes(show) {
  const listed = Array.isArray(show.episode_run_time) ? show.episode_run_time.map(Number).find((value) => Number.isFinite(value) && value > 0) : void 0;
  if (listed && listed > 0) {
    return listed;
  }
  return runtimeOf(asRecord(show.last_episode_to_air)?.runtime) || runtimeOf(asRecord(show.next_episode_to_air)?.runtime);
}
function seriesTitle(name) {
  const trimmed = name.replace(/\s+Collection$/i, "").trim();
  return trimmed.length > 0 ? trimmed : name.trim();
}
function requireTitle(value) {
  const title = String(value ?? "").trim();
  if (title.length < 1 || title.length > 200) {
    throw new HttpError("TMDb did not return a usable title.", 400);
  }
  return title;
}
var HORROR_ADJACENT_GENRES = /* @__PURE__ */ new Set([27, 53, 9648, 878, 14, 10765]);
var DOCUMENTARY_GENRE = 99;
function isHorrorAdjacent(value) {
  return Array.isArray(value) && value.some((id) => HORROR_ADJACENT_GENRES.has(Number(id)));
}
function isDocumentary(value) {
  return Array.isArray(value) && value.some((id) => Number(id) === DOCUMENTARY_GENRE);
}
async function collectionIsHorrorAdjacent(collectionId) {
  try {
    const collection = await tmdbJson(`/collection/${collectionId}`);
    const parts = Array.isArray(collection.parts) ? collection.parts : [];
    return parts.some((part) => isHorrorAdjacent(asRecord(part)?.genre_ids));
  } catch {
    return false;
  }
}
function trimOverview(value) {
  const overview = String(value ?? "").trim();
  if (!overview) {
    return void 0;
  }
  return overview.length <= 180 ? overview : `${overview.slice(0, 177).trimEnd()}\u2026`;
}

// lib/poster.ts
var TABLES = {
  movie: { table: "movie", tmdbKind: "movie" },
  documentary: { table: "documentary", tmdbKind: "movie" },
  show: { table: "show", tmdbKind: "tv" },
  series: { table: "movieseries", tmdbKind: "collection" }
};
var POSTER_SIZES = /* @__PURE__ */ new Set(["w92", "w185", "w342", "w500", "w780"]);
var MAX_POSTER_BYTES = 8 * 1024 * 1024;
var posterSchema;
var posterSchemaKey = "";
function parsePosterPath(value) {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.length > 160 || path.includes("..") || /[^A-Za-z0-9._/-]/.test(path)) {
    return void 0;
  }
  return path;
}
function posterSize(value) {
  const size = String(value ?? "").trim();
  return POSTER_SIZES.has(size) ? size : "w500";
}
async function proxyTmdbPoster(path, size) {
  const parsed = parsePosterPath(path);
  if (!parsed) {
    throw new HttpError("That poster was not found.", 400);
  }
  const response = await fetch(`https://image.tmdb.org/t/p/${posterSize(size)}${parsed}`);
  if (!response.ok) {
    throw new HttpError("That poster was not found.", 404);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_POSTER_BYTES) {
    throw new HttpError("That poster was not found.", 404);
  }
  const type = response.headers.get("content-type") ?? "";
  return new Response(bytes, {
    headers: {
      "content-type": type.startsWith("image/") ? type : "image/jpeg",
      "cache-control": "private, max-age=86400"
    }
  });
}
async function ensurePosterSchema(connectionString) {
  if (!posterSchema || posterSchemaKey !== connectionString) {
    posterSchemaKey = connectionString;
    posterSchema = applyPosterSchema(connectionString).catch((error) => {
      posterSchema = void 0;
      throw error;
    });
  }
  await posterSchema;
}
async function applyPosterSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS posterpath TEXT");
  await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS posterpath TEXT");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS posterpath TEXT");
  try {
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS posterpath TEXT");
  } catch {
  }
}
async function savePoster(connectionString, kind, mediaId, value) {
  const path = parsePosterPath(value);
  if (!path) {
    return;
  }
  await writePosterValue(connectionString, kind, mediaId, path);
}
async function writePosterValue(connectionString, kind, mediaId, value) {
  const target = TABLES[kind];
  if (!target || !Number.isInteger(mediaId) || mediaId < 1) {
    return;
  }
  await ensurePosterSchema(connectionString);
  await execute(connectionString, `UPDATE ${target.table} SET posterpath = $1 WHERE id = $2`, [value, mediaId]);
}

// lib/catalog.ts
async function filmsFromCollection(collection) {
  const parts = Array.isArray(collection.parts) ? collection.parts : [];
  const films = [];
  for (const part of parts) {
    const record = asRecord(part);
    if (!record || !yearFrom(record.release_date)) {
      continue;
    }
    const tmdbId = Number(record.id);
    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
      continue;
    }
    const film = await tmdbJson(`/movie/${tmdbId}`);
    const title = String(film.title ?? record.title ?? "").trim();
    if (!title) {
      continue;
    }
    const posterPath = parsePosterPath(film.poster_path) ?? parsePosterPath(record.poster_path);
    films.push({
      tmdbId,
      title,
      year: yearFrom(film.release_date) ?? yearFrom(record.release_date),
      runtime: runtimeOf(film.runtime),
      ...posterPath ? { posterPath } : {}
    });
  }
  return films;
}
async function findMovieId(connectionString, title, year, tmdbId) {
  if (tmdbId && tmdbId > 0) {
    try {
      const byTmdb = await queryRows(connectionString, "SELECT id FROM movie WHERE tmdbid = $1 LIMIT 1", [tmdbId]);
      const match = asId(byTmdb[0]);
      if (match) {
        return match;
      }
    } catch {
    }
  }
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movie WHERE lower(title) = lower($1) AND releaseyear = $2 LIMIT 1",
    [title, year ?? 0]
  );
  return asId(rows[0]);
}
async function addMovieToListsContainingSeries(connectionString, seriesId, movieId) {
  try {
    await execute(
      connectionString,
      `INSERT INTO user_list_item (list_id, media_kind, media_id)
       SELECT list_id, 'movie', $1
       FROM user_list_item
       WHERE media_kind = 'series' AND media_id = $2
       ON CONFLICT (list_id, media_kind, media_id) DO NOTHING`,
      [movieId, seriesId]
    );
  } catch {
  }
}
async function addMovieToFranchisesContainingSeries(connectionString, seriesId, movieId) {
  try {
    await execute(
      connectionString,
      `INSERT INTO franchise_item (franchise_id, media_kind, media_id)
       SELECT franchise_id, 'movie', $1
       FROM franchise_item
       WHERE media_kind = 'series' AND media_id = $2
       ON CONFLICT (franchise_id, media_kind, media_id) DO NOTHING`,
      [movieId, seriesId]
    );
  } catch {
  }
}
async function upsertShowSeasons(connectionString, showId, show) {
  const seasons = Array.isArray(show.seasons) ? show.seasons : [];
  for (const season of seasons) {
    const record = asRecord(season);
    if (!record) {
      continue;
    }
    const number = Number(record.season_number);
    if (!Number.isInteger(number) || number < 0) {
      continue;
    }
    const title = String(record.name ?? "").trim() || (number === 0 ? "Specials" : `Season ${number}`);
    await execute(
      connectionString,
      `INSERT INTO show_season (show_id, season_number, title)
       VALUES ($1, $2, $3)
       ON CONFLICT (show_id, season_number) DO UPDATE SET title = EXCLUDED.title`,
      [showId, number, title]
    );
  }
}

// lib/keywords.ts
async function saveMovieKeywords(connectionString, movieId, tmdbId, skipIfPresent = false) {
  await saveKeywords(connectionString, "movie", movieId, tmdbId, "movie", skipIfPresent);
}
async function saveDocumentaryKeywords(connectionString, documentaryId, tmdbId, skipIfPresent = false) {
  await saveKeywords(connectionString, "documentary", documentaryId, tmdbId, "movie", skipIfPresent);
}
async function saveShowKeywords(connectionString, showId, tmdbId, skipIfPresent = false) {
  await saveKeywords(connectionString, "show", showId, tmdbId, "tv", skipIfPresent);
}
async function saveKeywords(connectionString, kind, mediaId, tmdbId, tmdbKind, skipIfPresent) {
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return;
  }
  try {
    await ensureKeywordSchema(connectionString);
    if (kind === "movie") {
      await execute(connectionString, "UPDATE movie SET tmdbid = $1 WHERE id = $2", [tmdbId, mediaId]);
    } else if (kind === "documentary") {
      await execute(connectionString, "UPDATE documentary SET tmdbid = $1 WHERE id = $2", [tmdbId, mediaId]);
    }
    if (skipIfPresent && await hasKeywords(connectionString, kind, mediaId)) {
      return;
    }
    const payload = await tmdbJson(`/${tmdbKind}/${tmdbId}/keywords`);
    const raw = Array.isArray(payload.keywords) ? payload.keywords : Array.isArray(payload.results) ? payload.results : [];
    await execute(connectionString, "DELETE FROM media_keyword WHERE media_kind = $1 AND media_id = $2", [kind, mediaId]);
    for (const item of raw) {
      const record = asRecord(item);
      const keywordId = Number(record?.id);
      const name = String(record?.name ?? "").trim();
      if (!Number.isInteger(keywordId) || keywordId < 1 || name.length < 1 || name.length > 80) {
        continue;
      }
      await execute(
        connectionString,
        `INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name`,
        [kind, mediaId, keywordId, name]
      );
    }
  } catch {
  }
}
async function replaceSeriesKeywords(connectionString, seriesId) {
  try {
    await ensureKeywordSchema(connectionString);
    await execute(connectionString, "DELETE FROM media_keyword WHERE media_kind = 'series' AND media_id = $1", [seriesId]);
    await execute(
      connectionString,
      `INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
       SELECT DISTINCT ON (k.tmdb_keyword_id) 'series', $1, k.tmdb_keyword_id, k.name
       FROM media_keyword k
       JOIN movie m ON m.id = k.media_id
       WHERE k.media_kind = 'movie' AND m.seriesid = $1
       ORDER BY k.tmdb_keyword_id, k.name
       ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO NOTHING`,
      [seriesId]
    );
  } catch {
  }
}
async function ensureKeywordSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS media_keyword (
      media_kind TEXT NOT NULL,
      media_id INTEGER NOT NULL,
      tmdb_keyword_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (media_kind, media_id, tmdb_keyword_id)
    )`
  );
}
async function hasKeywords(connectionString, kind, mediaId) {
  const rows = await queryRows(
    connectionString,
    "SELECT 1 AS present FROM media_keyword WHERE media_kind = $1 AND media_id = $2 LIMIT 1",
    [kind, mediaId]
  );
  return Boolean(rows[0]);
}

// lib/import-tmdb.ts
async function importMovie(connectionString, tmdbId) {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date);
  const collection = asRecord(movie.belongs_to_collection);
  const collectionId = asId(collection);
  if (collectionId) {
    await queueHorrorCollection(connectionString, collectionId);
  }
  const seriesName = collection ? seriesTitle(String(collection.name ?? "")) : "";
  const seriesId = seriesName ? await findSeriesId(connectionString, seriesName) : void 0;
  const existingId = await findMovieId(connectionString, title, year, tmdbId);
  if (existingId) {
    if (seriesId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, existingId);
      await addMovieToFranchisesContainingSeries(connectionString, seriesId, existingId);
    }
    await saveMovieKeywords(connectionString, existingId, tmdbId);
    await savePoster(connectionString, "movie", existingId, movie.poster_path);
    return { added: 0, id: `movie:${existingId}` };
  }
  const movieId = await insertMovie(connectionString, title, runtimeOf(movie.runtime), seriesId, year);
  if (!movieId) {
    throw new HttpError("Could not save that movie.", 500);
  }
  await saveMovieKeywords(connectionString, movieId, tmdbId);
  await savePoster(connectionString, "movie", movieId, movie.poster_path);
  if (seriesId) {
    await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
    await addMovieToFranchisesContainingSeries(connectionString, seriesId, movieId);
    await invalidateSeriesCompletion(connectionString, seriesId);
    await refreshSeriesTotals(connectionString, seriesId);
    await replaceSeriesKeywords(connectionString, seriesId);
  }
  return { added: 1, id: `movie:${movieId}` };
}
async function importSeries(connectionString, collectionId) {
  const collection = await tmdbJson(`/collection/${collectionId}`);
  const title = seriesTitle(String(collection.name ?? ""));
  if (!title) {
    throw new HttpError("TMDb did not return a usable title.", 400);
  }
  let seriesId = await findSeriesId(connectionString, title);
  let added = 0;
  if (!seriesId) {
    seriesId = await insertSeries(connectionString, title);
    added += 1;
  }
  try {
    await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
    await execute(connectionString, "UPDATE movieseries SET tmdbid = $1 WHERE id = $2", [collectionId, seriesId]);
  } catch {
  }
  await savePoster(connectionString, "series", seriesId, collection.poster_path);
  for (const film of await filmsFromCollection(collection)) {
    const existingId = await findMovieId(connectionString, film.title, film.year, film.tmdbId);
    if (existingId) {
      await linkMovieToSeries(connectionString, existingId, seriesId);
      await saveMovieKeywords(connectionString, existingId, film.tmdbId, true);
      await savePoster(connectionString, "movie", existingId, film.posterPath);
      continue;
    }
    const movieId = await insertMovie(connectionString, film.title, film.runtime, seriesId, film.year);
    if (movieId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
      await addMovieToFranchisesContainingSeries(connectionString, seriesId, movieId);
      await invalidateSeriesCompletion(connectionString, seriesId);
      await saveMovieKeywords(connectionString, movieId, film.tmdbId);
      await savePoster(connectionString, "movie", movieId, film.posterPath);
    }
    added += 1;
  }
  await refreshSeriesTotals(connectionString, seriesId);
  await replaceSeriesKeywords(connectionString, seriesId);
  return { added, id: `series:${seriesId}` };
}
async function ensureImportSchema(connectionString) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS catalog_import (
        id TEXT PRIMARY KEY,
        cursor JSONB NOT NULL,
        added INTEGER NOT NULL DEFAULT 0,
        skipped INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS catalog_import_collection (
        tmdbid INTEGER PRIMARY KEY,
        queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        imported_at TIMESTAMPTZ
      )`
  );
}
async function queueHorrorCollection(connectionString, tmdbId) {
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return;
  }
  await ensureImportSchema(connectionString);
  await execute(
    connectionString,
    `INSERT INTO catalog_import_collection (tmdbid)
     VALUES ($1)
     ON CONFLICT (tmdbid) DO NOTHING`,
    [tmdbId]
  );
}
async function findSeriesId(connectionString, title) {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movieseries WHERE lower(title) = lower($1) LIMIT 1",
    [title]
  );
  return asId(rows[0]);
}
async function insertMovie(connectionString, title, totalTime, seriesId, year) {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO movie (title, totaltime, partofseries, seriesid, releaseyear, watched) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id",
    [title, totalTime, Boolean(seriesId), seriesId ?? null, year ?? 0]
  );
  return asId(rows[0]);
}
async function insertSeries(connectionString, title) {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ($1, 0, 0, FALSE) RETURNING id",
    [title]
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new HttpError("Could not save that series.", 500);
  }
  return id;
}
async function invalidateSeriesCompletion(connectionString, seriesId) {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'series' AND media_id = $1", [seriesId]);
  } catch {
  }
}
async function linkMovieToSeries(connectionString, movieId, seriesId) {
  await execute(
    connectionString,
    "UPDATE movie SET partofseries = TRUE, seriesid = $1 WHERE id = $2 AND (seriesid IS NULL OR seriesid = 0)",
    [seriesId, movieId]
  );
}
async function refreshSeriesTotals(connectionString, seriesId) {
  await execute(
    connectionString,
    `UPDATE movieseries
     SET totalmovies = (SELECT COUNT(*) FROM movie WHERE seriesid = $1),
         totaltime = COALESCE((SELECT SUM(totaltime) FROM movie WHERE seriesid = $1), 0)
     WHERE id = $1`,
    [seriesId]
  );
}

// lib/open-library.ts
var USER_AGENT = "HorrorVerse/1.0 (https://horrorverse.vercel.app)";
var MAX_RESULTS = 8;
var SEARCH_POOL = 20;
var HORROR_SUBJECT = /horror|ghost|haunt|vampire|zombie|werewolf|witch|demon|occult|supernatural|gothic|monster|paranormal|lovecraft/i;
var MAX_SUBJECTS = 12;
function parseWorkId(value) {
  const raw = String(value ?? "").trim();
  const key = raw.startsWith("/works/") ? raw.slice("/works/".length) : raw;
  return /^OL\d+W$/.test(key) ? key : void 0;
}
function openLibraryCoverUrl(coverId) {
  const id = Number(coverId);
  if (!Number.isInteger(id) || id < 1) {
    return void 0;
  }
  return `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
}
function parseOpenLibrarySearch(payload) {
  const docs = docsOf(payload);
  const hits = [];
  docs.forEach((doc, index) => {
    const sourceId = parseWorkId(doc.key);
    const title = cleanText(doc.title, 200);
    if (!sourceId || !title) {
      return;
    }
    const author = joinNames(doc.author_name, 180);
    const subjects = namesOf(doc.subject);
    const overview = [author, subjects.slice(0, 3).join(", ")].filter(Boolean).join(" \xB7 ");
    const year = yearOf(doc.first_publish_year);
    const coverUrl = openLibraryCoverUrl(doc.cover_i);
    hits.push({
      horror: subjects.some((subject) => HORROR_SUBJECT.test(subject)),
      index,
      hit: {
        sourceId,
        title,
        ...year ? { year } : {},
        ...overview ? { overview } : {},
        ...coverUrl ? { coverUrl } : {}
      }
    });
  });
  return hits.sort((left, right) => Number(right.horror) - Number(left.horror) || left.index - right.index).slice(0, MAX_RESULTS).map((item) => item.hit);
}
function parseOpenLibraryWork(workId, work, searchDoc) {
  const sourceId = parseWorkId(workId);
  const record = asRecord2(work);
  const doc = asRecord2(searchDoc);
  const title = titled(cleanText(record?.title, 160), cleanText(doc?.title, 160), cleanText(record?.subtitle ?? doc?.subtitle, 80));
  if (!sourceId || !title) {
    return void 0;
  }
  const author = joinNames(doc?.author_name, 180);
  const year = yearOf(doc?.first_publish_year) ?? 0;
  const pages = positiveInt(doc?.number_of_pages_median) ?? 0;
  const description = cleanText(descriptionOf(record?.description), 4e3);
  const isbn = pickIsbn(doc?.isbn);
  const publisher = namesOf(doc?.publisher)[0];
  const coverUrl = openLibraryCoverUrl(doc?.cover_i) ?? openLibraryCoverUrl(firstOf(record?.covers));
  const subjects = uniqueNames([...namesOf(record?.subjects), ...namesOf(doc?.subject)]).slice(0, MAX_SUBJECTS);
  return {
    sourceId,
    title,
    year,
    pages,
    subjects,
    ...author ? { author } : {},
    ...description ? { description } : {},
    ...isbn ? { isbn } : {},
    ...publisher ? { publisher: publisher.slice(0, 200) } : {},
    ...coverUrl ? { coverUrl } : {}
  };
}
async function searchOpenLibrary(query) {
  const payload = await openLibraryJson(
    `/search.json?q=${encodeURIComponent(query)}&limit=${SEARCH_POOL}&fields=key,title,subtitle,author_name,first_publish_year,cover_i,subject`
  );
  return parseOpenLibrarySearch(payload);
}
async function importOpenLibraryBook(connectionString, workId) {
  const sourceId = parseWorkId(workId);
  if (!sourceId) {
    throw new HttpError("Choose an Open Library book to add.", 400);
  }
  await ensureBookColumns(connectionString);
  const [work, search] = await Promise.all([
    openLibraryJson(`/works/${sourceId}.json`),
    openLibraryJson(
      `/search.json?q=${encodeURIComponent(`key:/works/${sourceId}`)}&limit=1&fields=title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,isbn,publisher,subject`
    )
  ]);
  const book = parseOpenLibraryWork(sourceId, work, docsOf(search)[0]);
  if (!book) {
    throw new HttpError("Open Library did not return that book.", 502);
  }
  const existing = await queryRows(connectionString, "SELECT id FROM book WHERE openlibraryid = $1 LIMIT 1", [book.sourceId]);
  const existingId = asId(existing[0]);
  const bookId = existingId ?? await insertBook(connectionString, book);
  await updateBook(connectionString, bookId, book);
  await saveBookSubjects(connectionString, bookId, book.subjects);
  return { added: existingId ? 0 : 1, id: `book:${bookId}` };
}
async function insertBook(connectionString, book) {
  const rows = await queryRows(
    connectionString,
    `INSERT INTO book (title, seriesid, pages, partofseries, releaseyear, read, openlibraryid)
     VALUES ($1, NULL, $2, FALSE, $3, FALSE, $4)
     RETURNING id`,
    [book.title, book.pages, book.year, book.sourceId]
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new HttpError("Could not save that book.", 500);
  }
  return id;
}
async function updateBook(connectionString, bookId, book) {
  await execute(
    connectionString,
    `UPDATE book
     SET title = $2,
         pages = CASE WHEN $3 > 0 THEN $3 ELSE pages END,
         releaseyear = CASE WHEN $4 > 0 THEN $4 ELSE releaseyear END,
         openlibraryid = $5,
         author = $6,
         description = $7,
         isbn = $8,
         publisher = $9,
         coverurl = $10
     WHERE id = $1`,
    [
      bookId,
      book.title,
      book.pages,
      book.year,
      book.sourceId,
      book.author ?? null,
      book.description ?? null,
      book.isbn ?? null,
      book.publisher ?? null,
      book.coverUrl ?? null
    ]
  );
}
async function saveBookSubjects(connectionString, bookId, subjects) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS media_keyword (
      media_kind TEXT NOT NULL,
      media_id INTEGER NOT NULL,
      tmdb_keyword_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (media_kind, media_id, tmdb_keyword_id)
    )`
  );
  await execute(connectionString, "DELETE FROM media_keyword WHERE media_kind = 'book' AND media_id = $1", [bookId]);
  for (const subject of subjects) {
    await execute(
      connectionString,
      `INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
       VALUES ('book', $1, $2, $3)
       ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name`,
      [bookId, subjectKey(subject), subject]
    );
  }
}
async function ensureBookColumns(connectionString) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS book (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      seriesid INTEGER,
      pages INTEGER NOT NULL,
      partofseries BOOLEAN NOT NULL,
      releaseyear INTEGER NOT NULL,
      read BOOLEAN NOT NULL
    )`
  );
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS openlibraryid TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS author TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS description TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS isbn TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS publisher TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS coverurl TEXT");
}
function subjectKey(name) {
  let hash = 0;
  for (const char of name.toLowerCase()) {
    hash = hash * 33 + char.charCodeAt(0) >>> 0;
  }
  return hash % 2e9 || 1;
}
async function openLibraryJson(path) {
  const response = await fetch(`https://openlibrary.org${path}`, {
    headers: { accept: "application/json", "user-agent": USER_AGENT }
  });
  if (!response.ok) {
    throw new HttpError("Could not reach Open Library.", 502);
  }
  return response.json();
}
function docsOf(payload) {
  const record = asRecord2(payload);
  return Array.isArray(record?.docs) ? record.docs.map(asRecord2).filter((doc) => Boolean(doc)) : [];
}
function asRecord2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function descriptionOf(value) {
  if (typeof value === "string") {
    return value;
  }
  const record = asRecord2(value);
  return typeof record?.value === "string" ? record.value : "";
}
function titled(workTitle, searchTitle, subtitle) {
  const title = workTitle || searchTitle;
  if (!title) {
    return void 0;
  }
  if (!subtitle || title.toLowerCase().includes(subtitle.toLowerCase())) {
    return title;
  }
  const combined = `${title}: ${subtitle}`;
  return combined.length <= 200 ? combined : title;
}
function joinNames(value, max) {
  const names = namesOf(value);
  if (names.length < 1) {
    return void 0;
  }
  return names.slice(0, 4).join(", ").slice(0, max);
}
function namesOf(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueNames(value.map((item) => cleanText(item, 80)).filter((item) => Boolean(item)));
}
function uniqueNames(names) {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(name);
  }
  return unique;
}
function pickIsbn(value) {
  const isbns = namesOf(value).map((isbn) => isbn.replace(/[^0-9X]/gi, ""));
  return isbns.find((isbn) => isbn.length === 13) ?? isbns.find((isbn) => isbn.length === 10);
}
function yearOf(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1 && year <= 3e3 ? year : void 0;
}
function positiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : void 0;
}
function firstOf(value) {
  return Array.isArray(value) ? value[0] : void 0;
}
function cleanText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return void 0;
  }
  return text.length > max ? text.slice(0, max).trim() : text;
}

// api-src/tmdb.ts
var runtime = "nodejs";
var maxDuration = 60;
var MAX_RESULTS2 = 8;
var MAX_COLLECTION_CANDIDATES = 16;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
    const url = new URL(request.url);
    const poster = parsePosterPath(url.searchParams.get("poster"));
    if (poster) {
      return proxyTmdbPoster(poster, url.searchParams.get("size"));
    }
    const kind = normalizeTmdbKind(url.searchParams.get("kind") ?? "movie");
    const query = (url.searchParams.get("q") ?? "").trim();
    if (query.length < 2) {
      throw new TmdbError(kind === "book" ? "Enter at least two characters to search Open Library." : "Enter at least two characters to search TMDb.", 400);
    }
    if (kind === "book") {
      return Response.json({ results: await searchOpenLibrary(query) });
    }
    const results = kind === "series" ? await searchCollections(query) : kind === "show" ? await searchShows(query) : kind === "documentary" ? await searchDocumentaries(query) : await searchMovies(query);
    return Response.json({ results });
  } catch (error) {
    return jsonError(error, { log: "TMDb request failed.", fallback: "Could not talk to TMDb." });
  }
}
async function POST(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
    const body = await request.json().catch(() => ({}));
    const kind = normalizeTmdbKind(body.kind ?? "movie");
    if (kind === "book") {
      return Response.json(await importOpenLibraryBook(connectionString, String(body.sourceId ?? "")));
    }
    const tmdbId = Number(body.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
      throw new TmdbError("Choose a TMDb title to add.", 400);
    }
    const imported = kind === "series" ? await importSeries(connectionString, tmdbId) : kind === "show" ? await importShow(connectionString, tmdbId) : kind === "documentary" ? await importDocumentary(connectionString, tmdbId) : await importMovie(connectionString, tmdbId);
    return Response.json(imported);
  } catch (error) {
    return jsonError(error, { log: "TMDb request failed.", fallback: "Could not talk to TMDb." });
  }
}
async function searchMovies(query) {
  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload).filter((item) => isHorrorAdjacent(item.genre_ids) && !isDocumentary(item.genre_ids)).slice(0, MAX_RESULTS2).map((item) => ({
    tmdbId: Number(item.id),
    title: String(item.title ?? "").trim(),
    year: yearFrom(item.release_date),
    overview: trimOverview(item.overview)
  })).filter((item) => item.tmdbId > 0 && item.title.length > 0);
}
async function searchDocumentaries(query) {
  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload).filter((item) => isDocumentary(item.genre_ids)).slice(0, MAX_RESULTS2).map((item) => ({
    tmdbId: Number(item.id),
    title: String(item.title ?? "").trim(),
    year: yearFrom(item.release_date),
    overview: trimOverview(item.overview)
  })).filter((item) => item.tmdbId > 0 && item.title.length > 0);
}
async function searchCollections(query) {
  const payload = await tmdbJson(`/search/collection?query=${encodeURIComponent(query)}`);
  const hits = [];
  for (const item of asResults(payload).slice(0, MAX_COLLECTION_CANDIDATES)) {
    if (hits.length >= MAX_RESULTS2) {
      break;
    }
    const tmdbId = Number(item.id);
    const title = seriesTitle(String(item.name ?? ""));
    if (!Number.isInteger(tmdbId) || tmdbId < 1 || title.length < 1) {
      continue;
    }
    if (!await collectionIsHorrorAdjacent(tmdbId)) {
      continue;
    }
    hits.push({
      tmdbId,
      title,
      overview: trimOverview(item.overview)
    });
  }
  return hits;
}
async function searchShows(query) {
  const payload = await tmdbJson(`/search/tv?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload).filter((item) => isHorrorAdjacent(item.genre_ids) || isDocumentary(item.genre_ids)).slice(0, MAX_RESULTS2).map((item) => ({
    tmdbId: Number(item.id),
    title: String(item.name ?? "").trim(),
    year: yearFrom(item.first_air_date),
    overview: trimOverview(item.overview)
  })).filter((item) => item.tmdbId > 0 && item.title.length > 0);
}
async function importDocumentary(connectionString, tmdbId) {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date) ?? (/* @__PURE__ */ new Date()).getUTCFullYear();
  const existingId = await findDocumentaryId(connectionString, title, year);
  if (existingId) {
    await saveDocumentaryKeywords(connectionString, existingId, tmdbId);
    await savePoster(connectionString, "documentary", existingId, movie.poster_path);
    return { added: 0, id: `documentary:${existingId}` };
  }
  const documentaryId = await insertDocumentary(connectionString, title, runtimeOf(movie.runtime), year);
  await saveDocumentaryKeywords(connectionString, documentaryId, tmdbId);
  await savePoster(connectionString, "documentary", documentaryId, movie.poster_path);
  return { added: 1, id: `documentary:${documentaryId}` };
}
async function importShow(connectionString, tmdbId) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS show (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      totaltime DECIMAL(10, 2) NOT NULL,
      totalepisodes INTEGER NOT NULL,
      numberofseasons INTEGER NOT NULL,
      watched BOOLEAN NOT NULL
    )`
  );
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER");
  const show = await tmdbJson(`/tv/${tmdbId}`);
  const title = requireTitle(show.name);
  const year = yearFrom(show.first_air_date);
  const existingId = await findShowId(connectionString, tmdbId, title, year);
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const seasons = Math.max(Number(show.number_of_seasons) || 0, 0);
  const totalTime = showTotalMinutes(show);
  const showId = existingId ?? await insertShow(connectionString, title, totalTime, episodes, seasons, year);
  if (!showId) {
    throw new TmdbError("Could not save that show.", 500);
  }
  await attachShowSeasons(connectionString, showId, tmdbId, show, year);
  await saveShowKeywords(connectionString, showId, tmdbId);
  await savePoster(connectionString, "show", showId, show.poster_path);
  return { added: existingId ? 0 : 1, id: `show:${showId}` };
}
async function findDocumentaryId(connectionString, title, year) {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM documentary WHERE lower(title) = lower($1) AND releaseyear = $2 LIMIT 1",
    [title, year]
  );
  return asId(rows[0]);
}
async function findShowId(connectionString, tmdbId, title, year) {
  try {
    const byTmdb = await queryRows(connectionString, "SELECT id FROM show WHERE tmdbid = $1 LIMIT 1", [tmdbId]);
    const tmdbMatch = asId(byTmdb[0]);
    if (tmdbMatch) {
      return tmdbMatch;
    }
    const rows = await queryRows(
      connectionString,
      `SELECT id FROM show
       WHERE lower(title) = lower($1)
         AND tmdbid IS NULL
         AND (releaseyear IS NULL OR releaseyear = 0 OR releaseyear = $2)
       LIMIT 1`,
      [title, year ?? 0]
    );
    return asId(rows[0]);
  } catch {
    return void 0;
  }
}
async function insertDocumentary(connectionString, title, totalTime, year) {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO documentary (title, totaltime, releaseyear, watched) VALUES ($1, $2, $3, FALSE) RETURNING id",
    [title, totalTime, year]
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new TmdbError("Could not save that documentary.", 500);
  }
  return id;
}
async function attachShowSeasons(connectionString, showId, tmdbId, show, year) {
  try {
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER", []);
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER", []);
    await execute(
      connectionString,
      "UPDATE show SET tmdbid = $1, releaseyear = COALESCE(NULLIF($3, 0), releaseyear), totaltime = CASE WHEN $4 > 0 THEN $4 ELSE totaltime END WHERE id = $2",
      [tmdbId, showId, year ?? 0, showTotalMinutes(show)]
    );
    await execute(
      connectionString,
      `CREATE TABLE IF NOT EXISTS show_season (
        id SERIAL PRIMARY KEY,
        show_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        UNIQUE (show_id, season_number)
      )`
    );
    await upsertShowSeasons(connectionString, showId, show);
  } catch {
  }
}
async function insertShow(connectionString, title, totalTime, episodes, seasons, year) {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id",
    [title, totalTime, episodes, seasons, year ?? 0]
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new TmdbError("Could not save that show.", 500);
  }
  return id;
}
function normalizeTmdbKind(kind) {
  const value = kind.trim().toLowerCase();
  if (value === "movie" || value === "series" || value === "documentary" || value === "show" || value === "book") {
    return value;
  }
  throw new TmdbError("TMDb can add movies, series, documentaries, and TV shows.", 400);
}
var TmdbError = class extends HttpError {
};
export {
  GET,
  POST,
  maxDuration,
  runtime
};
