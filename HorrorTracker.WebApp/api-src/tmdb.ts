export const runtime = "nodejs";
export const maxDuration = 60;
void "restore-standalone-tmdb";

import {
  addMovieToFranchisesContainingSeries,
  addMovieToListsContainingSeries,
  filmsFromCollection,
  findMovieId,
  upsertShowSeasons,
} from "../lib/catalog";
import {
  replaceSeriesKeywords,
  saveDocumentaryKeywords,
  saveMovieKeywords,
  saveShowKeywords,
} from "../lib/keywords";
import {
  execute,
  HttpError,
  jsonError as neonJsonError,
  queryRows,
  requireDatabaseUrl,
  requireSessionUser,
} from "../lib/neon";
import {
  asId,
  asRecord,
  asResults,
  collectionIsHorrorAdjacent,
  isDocumentary,
  isHorrorAdjacent,
  requireTitle,
  runtimeOf,
  seriesTitle,
  showTotalMinutes,
  tmdbJson,
  trimOverview,
  yearFrom,
} from "../lib/tmdb";

const MAX_RESULTS = 8;
const MAX_COLLECTION_CANDIDATES = 16;

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
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
    return neonJsonError(error, { log: "TMDb request failed.", fallback: "Could not talk to TMDb." });
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
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
    return neonJsonError(error, { log: "TMDb request failed.", fallback: "Could not talk to TMDb." });
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
    .filter((item) => isHorrorAdjacent(item.genre_ids) || isDocumentary(item.genre_ids))
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      tmdbId: Number(item.id),
      title: String(item.name ?? "").trim(),
      year: yearFrom(item.first_air_date),
      overview: trimOverview(item.overview),
    }))
    .filter((item) => item.tmdbId > 0 && item.title.length > 0);
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

  try {
    await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
    await execute(connectionString, "UPDATE movieseries SET tmdbid = $1 WHERE id = $2", [collectionId, seriesId]);
  } catch {
    // Older catalogs can still match series by title.
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

async function importDocumentary(connectionString: string, tmdbId: number): Promise<TmdbImportResult> {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date) ?? new Date().getUTCFullYear();
  const existingId = await findDocumentaryId(connectionString, title, year);
  if (existingId) {
    await saveDocumentaryKeywords(connectionString, existingId, tmdbId);
    return { added: 0, id: `documentary:${existingId}` };
  }

  const documentaryId = await insertDocumentary(connectionString, title, runtimeOf(movie.runtime), year);
  await saveDocumentaryKeywords(connectionString, documentaryId, tmdbId);
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
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER");
  const show = await tmdbJson(`/tv/${tmdbId}`);
  const title = requireTitle(show.name);
  const year = yearFrom(show.first_air_date);
  const existingId = await findShowId(connectionString, tmdbId, title, year);
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const seasons = Math.max(Number(show.number_of_seasons) || 0, 0);
  const totalTime = showTotalMinutes(show);
  const showId = existingId ?? (await insertShow(connectionString, title, totalTime, episodes, seasons, year));
  if (!showId) {
    throw new TmdbError("Could not save that show.", 500);
  }

  await attachShowSeasons(connectionString, showId, tmdbId, show, year);
  await saveShowKeywords(connectionString, showId, tmdbId);
  return { added: existingId ? 0 : 1, id: `show:${showId}` };
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

async function findShowId(
  connectionString: string,
  tmdbId: number,
  title: string,
  year: number | undefined,
): Promise<number | undefined> {
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
      [title, year ?? 0],
    );
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

async function attachShowSeasons(
  connectionString: string,
  showId: number,
  tmdbId: number,
  show: Record<string, unknown>,
  year: number | undefined,
): Promise<void> {
  try {
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER", []);
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER", []);
    await execute(
      connectionString,
      "UPDATE show SET tmdbid = $1, releaseyear = COALESCE(NULLIF($3, 0), releaseyear), totaltime = CASE WHEN $4 > 0 THEN $4 ELSE totaltime END WHERE id = $2",
      [tmdbId, showId, year ?? 0, showTotalMinutes(show)],
    );
    await execute(
      connectionString,
      `CREATE TABLE IF NOT EXISTS show_season (
        id SERIAL PRIMARY KEY,
        show_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        UNIQUE (show_id, season_number)
      )`,
    );
    await upsertShowSeasons(connectionString, showId, show);
  } catch {
    // Season tables are created on first signed-in use of a show.
  }
}

async function insertShow(
  connectionString: string,
  title: string,
  totalTime: number,
  episodes: number,
  seasons: number,
  year: number | undefined,
): Promise<number> {
  const rows = await queryRows(
    connectionString,
    "INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id",
    [title, totalTime, episodes, seasons, year ?? 0],
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new TmdbError("Could not save that show.", 500);
  }

  return id;
}

async function invalidateSeriesCompletion(connectionString: string, seriesId: number): Promise<void> {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'series' AND media_id = $1", [seriesId]);
  } catch {
    // Progress table is created on first signed-in use.
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

function normalizeTmdbKind(kind: string): string {
  const value = kind.trim().toLowerCase();
  if (value === "movie" || value === "series" || value === "documentary" || value === "show") {
    return value;
  }

  throw new TmdbError("TMDb can add movies, series, documentaries, and TV shows.", 400);
}

class TmdbError extends HttpError {}

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
