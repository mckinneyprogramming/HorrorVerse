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
    films.push({
      tmdbId,
      title,
      year: yearFrom(film.release_date) ?? yearFrom(record.release_date),
      runtime: runtimeOf(film.runtime)
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
async function ensureShowTmdbId(connectionString, showId) {
  const existing = asId((await queryRows(connectionString, "SELECT tmdbid FROM show WHERE id = $1", [showId]))[0], "tmdbid");
  if (existing) {
    return existing;
  }
  const row = (await queryRows(connectionString, "SELECT title, releaseyear FROM show WHERE id = $1", [showId]))[0];
  const title = String(row?.title ?? "").trim();
  if (title.length < 2) {
    return void 0;
  }
  const year = yearFrom(row?.releaseyear);
  const results = asResults(await tmdbJson(`/search/tv?query=${encodeURIComponent(title)}&include_adult=false`));
  const sameTitle = results.filter((item) => String(item.name ?? "").trim().toLowerCase() === title.toLowerCase());
  const match = (year ? sameTitle.find((item) => yearFrom(item.first_air_date) === year) : void 0) ?? sameTitle[0] ?? results[0];
  const tmdbId = Number(match?.id);
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return void 0;
  }
  await execute(connectionString, "UPDATE show SET tmdbid = $1 WHERE id = $2", [tmdbId, showId]);
  return tmdbId;
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
    return { added: 0, id: `movie:${existingId}` };
  }
  const movieId = await insertMovie(connectionString, title, runtimeOf(movie.runtime), seriesId, year);
  if (!movieId) {
    throw new HttpError("Could not save that movie.", 500);
  }
  await saveMovieKeywords(connectionString, movieId, tmdbId);
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
  for (const film of await filmsFromCollection(collection)) {
    const existingId = await findMovieId(connectionString, film.title, film.year, film.tmdbId);
    if (existingId) {
      await linkMovieToSeries(connectionString, existingId, seriesId);
      await saveMovieKeywords(connectionString, existingId, film.tmdbId, true);
      continue;
    }
    const movieId = await insertMovie(connectionString, film.title, film.runtime, seriesId, film.year);
    if (movieId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
      await addMovieToFranchisesContainingSeries(connectionString, seriesId, movieId);
      await invalidateSeriesCompletion(connectionString, seriesId);
      await saveMovieKeywords(connectionString, movieId, film.tmdbId);
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

// lib/horror-import.ts
var HORROR_GENRE = 27;
var FILM_BATCH = 8;
var COLLECTION_BATCH = 6;
var WINDOW_YEARS = 5;
var FIRST_YEAR = 1895;
var MAX_DISCOVER_PAGE = 500;
function filmWindows(now = /* @__PURE__ */ new Date()) {
  const last = now.getUTCFullYear() + 1;
  const windows = [];
  for (let year = FIRST_YEAR; year <= last; year += WINDOW_YEARS) {
    const end = Math.min(year + WINDOW_YEARS - 1, last);
    windows.push({ fromYear: year, from: `${year}-01-01`, to: `${end}-12-31` });
  }
  return windows;
}
function nextFilmCursor(cursor, consumed, pageCount, resultCount, windows) {
  const index = cursor.index + consumed;
  if (index < resultCount) {
    return { ...cursor, index, done: false };
  }
  if (cursor.page < pageCount && cursor.page < MAX_DISCOVER_PAGE) {
    return { fromYear: cursor.fromYear, page: cursor.page + 1, index: 0, done: false };
  }
  const windowIndex = windows.findIndex((window) => window.fromYear === cursor.fromYear);
  const next = windows[windowIndex + 1];
  if (!next) {
    return { fromYear: cursor.fromYear, page: cursor.page, index, done: true };
  }
  return { fromYear: next.fromYear, page: 1, index: 0, done: false };
}
async function importHorrorBatch(connectionString, kind) {
  await ensureImportSchema(connectionString);
  await ensureKeywordSchema(connectionString);
  return kind === "horror-collections" ? importCollectionBatch(connectionString) : importFilmBatch(connectionString);
}
async function importFilmBatch(connectionString) {
  const windows = filmWindows();
  const stored = await loadCursor(connectionString, "horror-films");
  let cursor = parseFilmCursor(stored.cursor, windows);
  if (cursor.done) {
    cursor = { fromYear: windows[0].fromYear, page: 1, index: 0, done: false };
  }
  const window = windows.find((item) => item.fromYear === cursor.fromYear) ?? windows[0];
  const payload = await tmdbJson(
    `/discover/movie?include_adult=false&include_video=false&language=en-US&page=${cursor.page}&sort_by=primary_release_date.asc&with_genres=${HORROR_GENRE}&primary_release_date.gte=${encodeURIComponent(window.from)}&primary_release_date.lte=${encodeURIComponent(window.to)}`
  );
  const results = asResults(payload).filter((item) => !isDocumentary(item.genre_ids));
  const pageCount = Math.min(Math.max(Number(payload.total_pages) || 1, 1), MAX_DISCOVER_PAGE);
  const slice = results.slice(cursor.index, cursor.index + FILM_BATCH);
  let batchAdded = 0;
  let batchSkipped = 0;
  for (const item of slice) {
    const tmdbId = asId(item);
    if (!tmdbId) {
      batchSkipped += 1;
      continue;
    }
    try {
      const imported = await importMovie(connectionString, tmdbId);
      if (imported.added > 0) {
        batchAdded += imported.added;
      } else {
        batchSkipped += 1;
      }
    } catch {
      batchSkipped += 1;
    }
  }
  const next = nextFilmCursor(cursor, slice.length, pageCount, results.length, windows);
  const added = stored.added + batchAdded;
  const skipped = stored.skipped + batchSkipped;
  await saveCursor(connectionString, "horror-films", next, added, skipped);
  const nextWindow = windows.find((item) => item.fromYear === next.fromYear) ?? window;
  return {
    import: "horror-films",
    done: next.done,
    added,
    skipped,
    batchAdded,
    batchSkipped,
    queued: await queuedCollectionCount(connectionString),
    label: next.done ? "Horror films are imported." : `Films ${nextWindow.from.slice(0, 4)}\u2013${nextWindow.to.slice(0, 4)}, page ${next.page}.`
  };
}
async function importCollectionBatch(connectionString) {
  const stored = await loadCursor(connectionString, "horror-collections");
  const rows = await queryRows(
    connectionString,
    "SELECT tmdbid FROM catalog_import_collection WHERE imported_at IS NULL ORDER BY queued_at, tmdbid LIMIT $1",
    [COLLECTION_BATCH]
  );
  let batchAdded = 0;
  let batchSkipped = 0;
  for (const row of rows) {
    const tmdbId = asId(row, "tmdbid");
    if (!tmdbId) {
      continue;
    }
    try {
      if (!await collectionIsHorrorAdjacent(tmdbId)) {
        batchSkipped += 1;
        await markCollectionImported(connectionString, tmdbId);
        continue;
      }
      const imported = await importSeries(connectionString, tmdbId);
      if (imported.added > 0) {
        batchAdded += imported.added;
      } else {
        batchSkipped += 1;
      }
    } catch {
      batchSkipped += 1;
    }
    await markCollectionImported(connectionString, tmdbId);
  }
  const added = stored.added + batchAdded;
  const skipped = stored.skipped + batchSkipped;
  const remaining = await queuedCollectionCount(connectionString);
  const done = remaining < 1;
  await saveCursor(connectionString, "horror-collections", { done }, added, skipped);
  return {
    import: "horror-collections",
    done,
    added,
    skipped,
    batchAdded,
    batchSkipped,
    queued: remaining,
    label: done ? "Horror collections are imported." : `${remaining} collection${remaining === 1 ? "" : "s"} still queued.`
  };
}
async function queuedCollectionCount(connectionString) {
  const rows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM catalog_import_collection WHERE imported_at IS NULL"
  );
  return Number(rows[0]?.count) || 0;
}
async function markCollectionImported(connectionString, tmdbId) {
  await execute(
    connectionString,
    "UPDATE catalog_import_collection SET imported_at = NOW() WHERE tmdbid = $1",
    [tmdbId]
  );
}
async function loadCursor(connectionString, id) {
  const rows = await queryRows(connectionString, "SELECT cursor, added, skipped FROM catalog_import WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) {
    return { cursor: {}, added: 0, skipped: 0 };
  }
  return {
    cursor: asCursor(row.cursor),
    added: Number(row.added) || 0,
    skipped: Number(row.skipped) || 0
  };
}
async function saveCursor(connectionString, id, cursor, added, skipped) {
  await execute(
    connectionString,
    `INSERT INTO catalog_import (id, cursor, added, skipped, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET cursor = EXCLUDED.cursor, added = EXCLUDED.added, skipped = EXCLUDED.skipped, updated_at = NOW()`,
    [id, JSON.stringify(cursor), added, skipped]
  );
}
function asCursor(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}
function parseFilmCursor(cursor, windows) {
  const fromYear = Number(cursor.fromYear);
  const page = Number(cursor.page);
  const index = Number(cursor.index);
  if (!windows.some((window) => window.fromYear === fromYear) || !Number.isInteger(page) || page < 1) {
    return { fromYear: windows[0].fromYear, page: 1, index: 0, done: false };
  }
  return {
    fromYear,
    page,
    index: Number.isInteger(index) && index > 0 ? index : 0,
    done: Boolean(cursor.done)
  };
}

// api-src/sync.ts
var runtime = "nodejs";
var maxDuration = 60;
var STALE_HOURS = 6;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const cron = isTrustedCron(request);
    const user = cron ? void 0 : await requireSessionUser(request, connectionString);
    const url = new URL(request.url);
    const id = (url.searchParams.get("id") ?? "").trim();
    await ensureSeriesSchema(connectionString);
    await ensureKeywordSchema(connectionString);
    if (id) {
      const added = await syncOne(connectionString, id);
      await refreshMissingKeywords(connectionString, id);
      return Response.json({ added });
    }
    const force = cron || Boolean(user?.isAdmin);
    let tagged = await refreshMissingKeywords(connectionString);
    if (!force && !await isVaultStale(connectionString)) {
      return Response.json({ added: tagged, seriesAdded: 0, showsAdded: 0, keywordsAdded: tagged, skipped: tagged === 0 });
    }
    const seriesAdded = await syncAllSeries(connectionString);
    const showsAdded = await syncAllShows(connectionString);
    tagged += await refreshMissingKeywords(connectionString);
    await markVaultSynced(connectionString);
    return Response.json({ added: seriesAdded + showsAdded + tagged, seriesAdded, showsAdded, keywordsAdded: tagged });
  } catch (error) {
    return jsonError(error, { log: "Vault sync failed.", fallback: "Could not refresh the vault from TMDb." });
  }
}
async function POST(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    if (!user.isAdmin) {
      throw new SyncError("Only the administrator can import the horror vault.", 403);
    }
    const body = await request.json().catch(() => ({}));
    const kind = body.import === "horror-films" || body.import === "horror-collections" ? body.import : void 0;
    if (!kind) {
      throw new SyncError("Choose horror-films or horror-collections.", 400);
    }
    return Response.json(await importHorrorBatch(connectionString, kind));
  } catch (error) {
    return jsonError(error, { log: "Horror import failed.", fallback: "Could not import horror titles from TMDb." });
  }
}
async function syncOne(connectionString, id) {
  const parts = id.split(":");
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new SyncError("Choose a series or show to refresh.", 400);
  }
  if (parts[0] === "series") {
    return syncSeries(connectionString, mediaId);
  }
  if (parts[0] === "show") {
    return syncShow(connectionString, mediaId);
  }
  throw new SyncError("HorrorVerse can refresh series and TV shows from TMDb.", 400);
}
async function syncAllSeries(connectionString) {
  const rows = await queryRows(connectionString, "SELECT id FROM movieseries ORDER BY id");
  let added = 0;
  for (const row of rows) {
    const seriesId = asId(row);
    if (!seriesId) {
      continue;
    }
    try {
      added += await syncSeries(connectionString, seriesId);
    } catch {
    }
  }
  return added;
}
async function syncAllShows(connectionString) {
  let rows = [];
  try {
    rows = await queryRows(connectionString, "SELECT id FROM show ORDER BY id");
  } catch {
    return 0;
  }
  let added = 0;
  for (const row of rows) {
    const showId = asId(row);
    if (!showId) {
      continue;
    }
    try {
      added += await syncShow(connectionString, showId);
    } catch {
    }
  }
  return added;
}
async function syncSeries(connectionString, seriesId) {
  const existing = await queryRows(connectionString, "SELECT id, title, tmdbid FROM movieseries WHERE id = $1", [seriesId]);
  if (!existing[0]) {
    throw new SyncError("That series was not found.", 400);
  }
  const title = String(existing[0].title ?? "").trim();
  const collectionId = asId(existing[0], "tmdbid") ?? await resolveSeriesTmdbId(title);
  if (!collectionId) {
    return 0;
  }
  await execute(connectionString, "UPDATE movieseries SET tmdbid = $1 WHERE id = $2", [collectionId, seriesId]);
  const collection = await tmdbJson(`/collection/${collectionId}`);
  let added = 0;
  for (const film of await filmsFromCollection(collection)) {
    const existingId = await findMovieId(connectionString, film.title, film.year);
    if (existingId) {
      await execute(
        connectionString,
        "UPDATE movie SET partofseries = TRUE, seriesid = $1 WHERE id = $2 AND (seriesid IS NULL OR seriesid = 0)",
        [seriesId, existingId]
      );
      await saveMovieKeywords(connectionString, existingId, film.tmdbId, true);
      continue;
    }
    const movieId = asId(
      (await queryRows(
        connectionString,
        "INSERT INTO movie (title, totaltime, partofseries, seriesid, releaseyear, watched) VALUES ($1, $2, TRUE, $3, $4, FALSE) RETURNING id",
        [film.title, film.runtime, seriesId, film.year ?? 0]
      ))[0]
    );
    if (movieId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
      await addMovieToFranchisesContainingSeries(connectionString, seriesId, movieId);
      await invalidateSeriesCompletion2(connectionString, seriesId);
      await saveMovieKeywords(connectionString, movieId, film.tmdbId);
      added += 1;
    }
  }
  await execute(
    connectionString,
    `UPDATE movieseries
     SET totalmovies = (SELECT COUNT(*) FROM movie WHERE seriesid = $1),
         totaltime = COALESCE((SELECT SUM(totaltime) FROM movie WHERE seriesid = $1), 0)
     WHERE id = $1`,
    [seriesId]
  );
  await replaceSeriesKeywords(connectionString, seriesId);
  return added;
}
async function resolveSeriesTmdbId(title) {
  if (title.length < 2) {
    return void 0;
  }
  for (const query of [title, `${title} Collection`]) {
    const payload = await tmdbJson(`/search/collection?query=${encodeURIComponent(query)}`);
    for (const item of asResults(payload)) {
      const name = seriesTitle(String(item.name ?? ""));
      const tmdbId = Number(item.id);
      if (!Number.isInteger(tmdbId) || tmdbId < 1 || name.toLowerCase() !== title.toLowerCase()) {
        continue;
      }
      if (await collectionIsHorrorAdjacent(tmdbId)) {
        return tmdbId;
      }
    }
  }
  return void 0;
}
async function syncShow(connectionString, showId) {
  await ensureShowSchema(connectionString);
  const existing = await queryRows(connectionString, "SELECT id FROM show WHERE id = $1", [showId]);
  if (!existing[0]) {
    throw new SyncError("That show was not found.", 400);
  }
  const tmdbId = await ensureShowTmdbId(connectionString, showId);
  if (!tmdbId) {
    return 0;
  }
  return refreshShowSeasons(connectionString, showId, tmdbId);
}
async function refreshShowSeasons(connectionString, showId, tmdbId) {
  const before = new Set(
    (await queryRows(connectionString, "SELECT season_number FROM show_season WHERE show_id = $1", [showId])).map(
      (row) => Number(row.season_number)
    )
  );
  const show = await tmdbJson(`/tv/${tmdbId}`);
  await upsertShowSeasons(connectionString, showId, show);
  await updateShowTotals(connectionString, showId, show);
  const after = (await queryRows(connectionString, "SELECT season_number FROM show_season WHERE show_id = $1", [showId])).map(
    (row) => Number(row.season_number)
  );
  const added = after.filter((number) => Number.isInteger(number) && !before.has(number)).length;
  if (added > 0) {
    await invalidateShowCompletion(connectionString, showId);
  }
  await saveShowKeywords(connectionString, showId, tmdbId, true);
  return added;
}
async function updateShowTotals(connectionString, showId, show) {
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const seasons = Math.max(Number(show.number_of_seasons) || 0, 0);
  const totalTime = showTotalMinutes(show);
  await execute(
    connectionString,
    "UPDATE show SET totalepisodes = $1, numberofseasons = $2, totaltime = $3, releaseyear = COALESCE(NULLIF($5, 0), releaseyear) WHERE id = $4",
    [episodes, seasons, totalTime, showId, yearFrom(show.first_air_date) ?? 0]
  );
}
async function ensureShowSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER");
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
}
async function ensureSeriesSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS catalog_sync (
      id INTEGER PRIMARY KEY,
      last_synced_at TIMESTAMPTZ NOT NULL
    )`
  );
}
async function isVaultStale(connectionString) {
  try {
    const rows = await queryRows(connectionString, "SELECT last_synced_at FROM catalog_sync WHERE id = 1");
    const value = rows[0]?.last_synced_at;
    if (!value) {
      return true;
    }
    const synced = new Date(String(value)).getTime();
    return !Number.isFinite(synced) || Date.now() - synced > STALE_HOURS * 60 * 60 * 1e3;
  } catch {
    return true;
  }
}
async function markVaultSynced(connectionString) {
  await execute(
    connectionString,
    `INSERT INTO catalog_sync (id, last_synced_at)
     VALUES (1, NOW())
     ON CONFLICT (id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at`
  );
}
async function invalidateSeriesCompletion2(connectionString, seriesId) {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'series' AND media_id = $1", [seriesId]);
  } catch {
  }
}
async function refreshMissingKeywords(connectionString, id) {
  await ensureKeywordSchema(connectionString);
  const parts = (id ?? "").split(":");
  const onlyKind = parts[0] || void 0;
  const onlyId = Number(parts[1]);
  const scopedId = Number.isInteger(onlyId) && onlyId > 0 ? onlyId : void 0;
  let added = 0;
  if (!onlyKind || onlyKind === "movie" || onlyKind === "series") {
    const movies = await queryRows(connectionString, "SELECT id, title, releaseyear, tmdbid FROM movie ORDER BY id");
    for (const row of movies) {
      const movieId = asId(row);
      if (!movieId || scopedId && onlyKind === "movie" && movieId !== scopedId) {
        continue;
      }
      try {
        if (await hasKeywords(connectionString, "movie", movieId)) {
          continue;
        }
        const tmdbId = asId(row, "tmdbid") ?? await resolveMovieTmdbId(String(row.title ?? ""), yearFrom(row.releaseyear));
        if (!tmdbId) {
          continue;
        }
        await saveMovieKeywords(connectionString, movieId, tmdbId);
        added += 1;
      } catch {
      }
    }
  }
  if (!onlyKind || onlyKind === "documentary") {
    const docs = await queryRows(connectionString, "SELECT id, title, releaseyear, tmdbid FROM documentary ORDER BY id");
    for (const row of docs) {
      const documentaryId = asId(row);
      if (!documentaryId || scopedId && documentaryId !== scopedId) {
        continue;
      }
      try {
        if (await hasKeywords(connectionString, "documentary", documentaryId)) {
          continue;
        }
        const tmdbId = asId(row, "tmdbid") ?? await resolveMovieTmdbId(String(row.title ?? ""), yearFrom(row.releaseyear));
        if (!tmdbId) {
          continue;
        }
        await saveDocumentaryKeywords(connectionString, documentaryId, tmdbId);
        added += 1;
      } catch {
      }
    }
  }
  if (!onlyKind || onlyKind === "show") {
    const shows = await queryRows(connectionString, "SELECT id, tmdbid FROM show ORDER BY id");
    for (const row of shows) {
      const showId = asId(row);
      if (!showId || scopedId && showId !== scopedId) {
        continue;
      }
      try {
        if (await hasKeywords(connectionString, "show", showId)) {
          continue;
        }
        const tmdbId = asId(row, "tmdbid");
        if (!tmdbId) {
          continue;
        }
        await saveShowKeywords(connectionString, showId, tmdbId);
        added += 1;
      } catch {
      }
    }
  }
  const seriesRows = await queryRows(connectionString, "SELECT id FROM movieseries ORDER BY id");
  for (const row of seriesRows) {
    const seriesId = asId(row);
    if (seriesId) {
      await replaceSeriesKeywords(connectionString, seriesId);
    }
  }
  return added;
}
async function resolveMovieTmdbId(title, year) {
  if (title.length < 2) {
    return void 0;
  }
  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(title)}&include_adult=false`);
  const matches = asResults(payload).filter(
    (item) => String(item.title ?? "").trim().toLowerCase() === title.toLowerCase()
  );
  const match = year !== void 0 ? matches.find((item) => yearFrom(item.release_date) === year) ?? matches[0] : matches[0];
  const tmdbId = Number(match?.id);
  return Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : void 0;
}
async function invalidateShowCompletion(connectionString, showId) {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'show' AND media_id = $1", [showId]);
  } catch {
  }
}
function isTrustedCron(request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (secret) {
    return authorization === `Bearer ${secret}`;
  }
  return request.headers.get("x-vercel-cron") === "1";
}
var SyncError = class extends HttpError {
};
export {
  GET,
  POST,
  maxDuration,
  runtime
};
