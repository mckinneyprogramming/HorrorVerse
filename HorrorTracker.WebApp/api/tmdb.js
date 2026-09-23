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
async function findMovieId(connectionString, title, year) {
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

// api-src/tmdb.ts
var runtime = "nodejs";
var maxDuration = 60;
var MAX_RESULTS = 8;
var MAX_COLLECTION_CANDIDATES = 16;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
    const url = new URL(request.url);
    const kind = normalizeTmdbKind(url.searchParams.get("kind") ?? "movie");
    const query = (url.searchParams.get("q") ?? "").trim();
    if (query.length < 2) {
      throw new TmdbError("Enter at least two characters to search TMDb.", 400);
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
  return asResults(payload).filter((item) => isHorrorAdjacent(item.genre_ids) && !isDocumentary(item.genre_ids)).slice(0, MAX_RESULTS).map((item) => ({
    tmdbId: Number(item.id),
    title: String(item.title ?? "").trim(),
    year: yearFrom(item.release_date),
    overview: trimOverview(item.overview)
  })).filter((item) => item.tmdbId > 0 && item.title.length > 0);
}
async function searchDocumentaries(query) {
  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload).filter((item) => isDocumentary(item.genre_ids)).slice(0, MAX_RESULTS).map((item) => ({
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
    if (hits.length >= MAX_RESULTS) {
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
  return asResults(payload).filter((item) => isHorrorAdjacent(item.genre_ids) || isDocumentary(item.genre_ids)).slice(0, MAX_RESULTS).map((item) => ({
    tmdbId: Number(item.id),
    title: String(item.name ?? "").trim(),
    year: yearFrom(item.first_air_date),
    overview: trimOverview(item.overview)
  })).filter((item) => item.tmdbId > 0 && item.title.length > 0);
}
async function importMovie(connectionString, tmdbId) {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date);
  const collection = asRecord(movie.belongs_to_collection);
  const seriesName = collection ? seriesTitle(String(collection.name ?? "")) : "";
  const seriesId = seriesName ? await findSeriesId(connectionString, seriesName) : void 0;
  const existingId = await findMovieId(connectionString, title, year);
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
    throw new TmdbError("Could not save that movie.", 500);
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
    throw new TmdbError("TMDb did not return a usable title.", 400);
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
    const existingId = await findMovieId(connectionString, film.title, film.year);
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
async function importDocumentary(connectionString, tmdbId) {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date) ?? (/* @__PURE__ */ new Date()).getUTCFullYear();
  const existingId = await findDocumentaryId(connectionString, title, year);
  if (existingId) {
    await saveDocumentaryKeywords(connectionString, existingId, tmdbId);
    return { added: 0, id: `documentary:${existingId}` };
  }
  const documentaryId = await insertDocumentary(connectionString, title, runtimeOf(movie.runtime), year);
  await saveDocumentaryKeywords(connectionString, documentaryId, tmdbId);
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
  const runtimes = Array.isArray(show.episode_run_time) ? show.episode_run_time.map(Number) : [];
  const episodeMinutes = runtimes.find((value) => value > 0) ?? 0;
  const totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
  const showId = existingId ?? await insertShow(connectionString, title, totalTime, episodes, seasons, year);
  if (!showId) {
    throw new TmdbError("Could not save that show.", 500);
  }
  await attachShowSeasons(connectionString, showId, tmdbId, show, year);
  await saveShowKeywords(connectionString, showId, tmdbId);
  return { added: existingId ? 0 : 1, id: `show:${showId}` };
}
async function findSeriesId(connectionString, title) {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movieseries WHERE lower(title) = lower($1) LIMIT 1",
    [title]
  );
  return asId(rows[0]);
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
    throw new TmdbError("Could not save that series.", 500);
  }
  return id;
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
      "UPDATE show SET tmdbid = $1, releaseyear = COALESCE(NULLIF($3, 0), releaseyear) WHERE id = $2",
      [tmdbId, showId, year ?? 0]
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
function normalizeTmdbKind(kind) {
  const value = kind.trim().toLowerCase();
  if (value === "movie" || value === "series" || value === "documentary" || value === "show") {
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
