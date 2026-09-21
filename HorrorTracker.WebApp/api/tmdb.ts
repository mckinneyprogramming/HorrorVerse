export const runtime = "nodejs";
export const maxDuration = 60;

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_RESULTS = 8;
const MAX_COLLECTION_CANDIDATES = 16;
const HORROR_ADJACENT_GENRES = new Set([27, 53, 9648]);
const DOCUMENTARY_GENRE = 99;

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireUser(request, connectionString);
    const url = new URL(request.url);
    const kind = normalizeTmdbKind(url.searchParams.get("kind") ?? "movie");
    const query = (url.searchParams.get("q") ?? "").trim();
    if (query.length < 2) {
      throw new TmdbError("Enter at least two characters to search TMDb.", 400);
    }

    const results =
      kind === "series"
        ? await searchCollections(query)
        : kind === "show"
          ? await searchShows(query)
          : kind === "documentary"
            ? await searchDocumentaries(query)
            : await searchMovies(query);
    return Response.json({ results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as { kind?: string; tmdbId?: number };
    const kind = normalizeTmdbKind(body.kind ?? "movie");
    const tmdbId = Number(body.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
      throw new TmdbError("Choose a TMDb title to add.", 400);
    }

    const imported =
      kind === "series"
        ? await importSeries(connectionString, tmdbId)
        : kind === "show"
          ? await importShow(connectionString, tmdbId)
          : kind === "documentary"
            ? await importDocumentary(connectionString, tmdbId)
            : await importMovie(connectionString, tmdbId);

    return Response.json(imported);
  } catch (error) {
    return jsonError(error);
  }
}

async function searchMovies(query: string): Promise<TmdbHit[]> {
  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload)
    .filter((item) => isHorrorAdjacent(item.genre_ids) && !isDocumentary(item.genre_ids))
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      tmdbId: Number(item.id),
      title: String(item.title ?? "").trim(),
      year: yearFrom(item.release_date),
      overview: trimOverview(item.overview),
    }))
    .filter((item) => item.tmdbId > 0 && item.title.length > 0);
}

async function searchDocumentaries(query: string): Promise<TmdbHit[]> {
  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload)
    .filter((item) => isDocumentary(item.genre_ids))
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      tmdbId: Number(item.id),
      title: String(item.title ?? "").trim(),
      year: yearFrom(item.release_date),
      overview: trimOverview(item.overview),
    }))
    .filter((item) => item.tmdbId > 0 && item.title.length > 0);
}

async function searchCollections(query: string): Promise<TmdbHit[]> {
  const payload = await tmdbJson(`/search/collection?query=${encodeURIComponent(query)}`);
  const hits: TmdbHit[] = [];
  for (const item of asResults(payload).slice(0, MAX_COLLECTION_CANDIDATES)) {
    if (hits.length >= MAX_RESULTS) {
      break;
    }

    const tmdbId = Number(item.id);
    const title = seriesTitle(String(item.name ?? ""));
    if (!Number.isInteger(tmdbId) || tmdbId < 1 || title.length < 1) {
      continue;
    }

    if (!(await collectionIsHorrorAdjacent(tmdbId))) {
      continue;
    }

    hits.push({
      tmdbId,
      title,
      overview: trimOverview(item.overview),
    });
  }

  return hits;
}

async function searchShows(query: string): Promise<TmdbHit[]> {
  const payload = await tmdbJson(`/search/tv?query=${encodeURIComponent(query)}&include_adult=false`);
  return asResults(payload)
    .filter((item) => isHorrorAdjacent(item.genre_ids))
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      tmdbId: Number(item.id),
      title: String(item.name ?? "").trim(),
      year: yearFrom(item.first_air_date),
      overview: trimOverview(item.overview),
    }))
    .filter((item) => item.tmdbId > 0 && item.title.length > 0);
}

async function collectionIsHorrorAdjacent(collectionId: number): Promise<boolean> {
  try {
    const collection = await tmdbJson(`/collection/${collectionId}`);
    const parts = Array.isArray(collection.parts) ? collection.parts : [];
    return parts.some((part) => isHorrorAdjacent(asRecord(part)?.genre_ids));
  } catch {
    return false;
  }
}

function isHorrorAdjacent(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some((id) => HORROR_ADJACENT_GENRES.has(Number(id)));
}

function isDocumentary(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some((id) => Number(id) === DOCUMENTARY_GENRE);
}

async function importMovie(connectionString: string, tmdbId: number): Promise<TmdbImportResult> {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date);
  const collection = asRecord(movie.belongs_to_collection);
  const seriesName = collection ? seriesTitle(String(collection.name ?? "")) : "";
  const seriesId = seriesName ? await findSeriesId(connectionString, seriesName) : undefined;
  const existingId = await findMovieId(connectionString, title, year);
  if (existingId) {
    if (seriesId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, existingId);
    }

    return { added: 0, id: `movie:${existingId}` };
  }

  const movieId = await insertMovie(connectionString, title, runtimeOf(movie.runtime), seriesId, year);
  if (!movieId) {
    throw new TmdbError("Could not save that movie.", 500);
  }

  if (seriesId) {
    await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
    await refreshSeriesTotals(connectionString, seriesId);
  }

  return { added: 1, id: `movie:${movieId}` };
}

async function importSeries(connectionString: string, collectionId: number): Promise<TmdbImportResult> {
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

  const parts = Array.isArray(collection.parts) ? collection.parts : [];
  for (const part of parts) {
    const record = asRecord(part);
    if (!record || !yearFrom(record.release_date)) {
      continue;
    }

    const film = await tmdbJson(`/movie/${Number(record.id)}`);
    const filmTitle = String(film.title ?? record.title ?? "").trim();
    if (filmTitle.length < 1) {
      continue;
    }

    const year = yearFrom(film.release_date) ?? yearFrom(record.release_date);
    const existingId = await findMovieId(connectionString, filmTitle, year);
    if (existingId) {
      await linkMovieToSeries(connectionString, existingId, seriesId);
      continue;
    }

    const movieId = await insertMovie(connectionString, filmTitle, runtimeOf(film.runtime), seriesId, year);
    if (movieId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
    }
    added += 1;
  }

  await refreshSeriesTotals(connectionString, seriesId);
  return { added, id: `series:${seriesId}` };
}

async function importDocumentary(connectionString: string, tmdbId: number): Promise<TmdbImportResult> {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date) ?? new Date().getUTCFullYear();
  const existingId = await findDocumentaryId(connectionString, title, year);
  if (existingId) {
    return { added: 0, id: `documentary:${existingId}` };
  }

  const documentaryId = await insertDocumentary(connectionString, title, runtimeOf(movie.runtime), year);
  return { added: 1, id: `documentary:${documentaryId}` };
}

async function importShow(connectionString: string, tmdbId: number): Promise<TmdbImportResult> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS show (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      totaltime DECIMAL(10, 2) NOT NULL,
      totalepisodes INTEGER NOT NULL,
      numberofseasons INTEGER NOT NULL,
      watched BOOLEAN NOT NULL
    )`,
  );
  const show = await tmdbJson(`/tv/${tmdbId}`);
  const title = requireTitle(show.name);
  const existingId = await findShowId(connectionString, title);
  if (existingId) {
    return { added: 0, id: `show:${existingId}` };
  }

  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const seasons = Math.max(Number(show.number_of_seasons) || 0, 0);
  const runtimes = Array.isArray(show.episode_run_time) ? show.episode_run_time.map(Number) : [];
  const episodeMinutes = runtimes.find((value) => value > 0) ?? 0;
  const totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
  const showId = await insertShow(connectionString, title, totalTime, episodes, seasons);
  return { added: 1, id: `show:${showId}` };
}

async function findMovieId(connectionString: string, title: string, year: number | undefined): Promise<number | undefined> {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movie WHERE lower(title) = lower($1) AND releaseyear = $2 LIMIT 1",
    [title, year ?? 0],
  );
  return asId(rows[0]);
}

async function findSeriesId(connectionString: string, title: string): Promise<number | undefined> {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movieseries WHERE lower(title) = lower($1) LIMIT 1",
    [title],
  );
  return asId(rows[0]);
}

async function findDocumentaryId(connectionString: string, title: string, year: number): Promise<number | undefined> {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM documentary WHERE lower(title) = lower($1) AND releaseyear = $2 LIMIT 1",
    [title, year],
  );
  return asId(rows[0]);
}

async function findShowId(connectionString: string, title: string): Promise<number | undefined> {
  try {
    const rows = await queryRows(connectionString, "SELECT id FROM show WHERE lower(title) = lower($1) LIMIT 1", [title]);
    return asId(rows[0]);
  } catch {
    return undefined;
  }
}

async function insertMovie(
  connectionString: string,
  title: string,
  totalTime: number,
  seriesId: number | undefined,
  year: number | undefined,
): Promise<number | undefined> {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO movie (title, totaltime, partofseries, seriesid, releaseyear, watched) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id",
    [title, totalTime, Boolean(seriesId), seriesId ?? null, year ?? 0],
  );
  return asId(rows[0]);
}

async function insertSeries(connectionString: string, title: string): Promise<number> {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ($1, 0, 0, FALSE) RETURNING id",
    [title],
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new TmdbError("Could not save that series.", 500);
  }

  return id;
}

async function insertDocumentary(connectionString: string, title: string, totalTime: number, year: number): Promise<number> {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO documentary (title, totaltime, releaseyear, watched) VALUES ($1, $2, $3, FALSE) RETURNING id",
    [title, totalTime, year],
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new TmdbError("Could not save that documentary.", 500);
  }

  return id;
}

async function insertShow(
  connectionString: string,
  title: string,
  totalTime: number,
  episodes: number,
  seasons: number,
): Promise<number> {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ($1, $2, $3, $4, FALSE) RETURNING id",
    [title, totalTime, episodes, seasons],
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new TmdbError("Could not save that show.", 500);
  }

  return id;
}

async function addMovieToListsContainingSeries(connectionString: string, seriesId: number, movieId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `INSERT INTO user_list_item (list_id, media_kind, media_id)
       SELECT list_id, 'movie', $1
       FROM user_list_item
       WHERE media_kind = 'series' AND media_id = $2
       ON CONFLICT (list_id, media_kind, media_id) DO NOTHING`,
      [movieId, seriesId],
    );
  } catch {
    // Personal lists may not exist yet.
  }
}

async function linkMovieToSeries(connectionString: string, movieId: number, seriesId: number): Promise<void> {
  await execute(
    connectionString,
    "UPDATE movie SET partofseries = TRUE, seriesid = $1 WHERE id = $2 AND (seriesid IS NULL OR seriesid = 0)",
    [seriesId, movieId],
  );
}

async function refreshSeriesTotals(connectionString: string, seriesId: number): Promise<void> {
  await execute(
    connectionString,
    `UPDATE movieseries
     SET totalmovies = (SELECT COUNT(*) FROM movie WHERE seriesid = $1),
         totaltime = COALESCE((SELECT SUM(totaltime) FROM movie WHERE seriesid = $1), 0)
     WHERE id = $1`,
    [seriesId],
  );
}

async function tmdbJson(path: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.TMDBKey?.trim();
  if (!apiKey) {
    throw new TmdbError("TMDBKey is not configured.", 503);
  }

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new TmdbError("Could not reach TMDb.", response.status === 401 ? 503 : 502);
  }

  return payload;
}

function asResults(payload: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(payload.results) ? payload.results.filter((item) => item && typeof item === "object") : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asId(row: Record<string, unknown> | undefined): number | undefined {
  const id = Number(row?.id);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function yearFrom(value: unknown): number | undefined {
  const text = String(value ?? "");
  const year = Number(text.slice(0, 4));
  return Number.isInteger(year) && year >= 1888 && year <= 3000 ? year : undefined;
}

function runtimeOf(value: unknown): number {
  const runtime = Number(value);
  return Number.isFinite(runtime) && runtime > 0 ? runtime : 0;
}

function seriesTitle(name: string): string {
  const trimmed = name.replace(/\s+Collection$/i, "").trim();
  return trimmed.length > 0 ? trimmed : name.trim();
}

function requireTitle(value: unknown): string {
  const title = String(value ?? "").trim();
  if (title.length < 1 || title.length > 200) {
    throw new TmdbError("TMDb did not return a usable title.", 400);
  }

  return title;
}

function trimOverview(value: unknown): string | undefined {
  const overview = String(value ?? "").trim();
  if (!overview) {
    return undefined;
  }

  return overview.length <= 180 ? overview : `${overview.slice(0, 177).trimEnd()}…`;
}

function normalizeTmdbKind(kind: string): string {
  const value = kind.trim().toLowerCase();
  if (value === "movie" || value === "series" || value === "documentary" || value === "show") {
    return value;
  }

  throw new TmdbError("TMDb can add movies, series, documentaries, and TV shows.", 400);
}

async function requireUser(request: Request, connectionString: string): Promise<void> {
  const token = readSessionToken(request);
  if (!token) {
    throw new TmdbError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    `SELECT u.id
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  if (!rows[0]) {
    throw new TmdbError("Sign in to continue.", 401);
  }
}

function readSessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return undefined;
  }

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

async function queryRows(connectionString: string, query: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const payload = await neonRequest(connectionString, query, params);
  if (!isNeonRows(payload)) {
    throw new Error("Neon HTTP response did not include rows.");
  }

  return payload.rows;
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
    throw new Error(neonErrorMessage(payload, response.status));
  }

  return payload;
}

function neonErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    return String((payload as { message: unknown }).message);
  }

  return `Neon HTTP ${status}`;
}

function isNeonRows(payload: unknown): payload is { rows: Record<string, unknown>[] } {
  return typeof payload === "object" && payload !== null && "rows" in payload && Array.isArray((payload as { rows: unknown }).rows);
}

function requireDatabaseUrl(): string {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new TmdbError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
}

function resolveDatabaseUrl(): string | undefined {
  const fromUrl = process.env.DATABASE_URL?.trim();
  if (fromUrl) {
    return toHttpDriverUrl(fromUrl);
  }

  const horrorVerseDb = process.env.HorrorVerseDb?.trim();
  if (!horrorVerseDb) {
    return undefined;
  }

  if (/^postgres(ql)?:\/\//i.test(horrorVerseDb)) {
    return toHttpDriverUrl(horrorVerseDb);
  }

  return toHttpDriverUrl(npgsqlToUri(horrorVerseDb));
}

function npgsqlToUri(connectionString: string): string {
  const values = new Map<string, string>();
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
    throw new Error("HorrorVerseDb is missing Host or Username.");
  }

  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgresql://${auth}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}

function toHttpDriverUrl(connectionString: string): string {
  const normalized = connectionString.replace(/^postgres:/i, "postgresql:");
  const url = new URL(normalized);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.set("sslmode", "require");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

function jsonError(error: unknown): Response {
  console.error("TMDb request failed.", error);
  if (error instanceof TmdbError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("not configured")) {
    return Response.json({ error: message }, { status: 503 });
  }

  return Response.json({ error: "Could not talk to TMDb." }, { status: 500 });
}

class TmdbError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface TmdbHit {
  tmdbId: number;
  title: string;
  year?: number;
  overview?: string;
}

interface TmdbImportResult {
  added: number;
  id: string;
}
