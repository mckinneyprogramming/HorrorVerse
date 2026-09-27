import {
  addMovieToFranchisesContainingSeries,
  addMovieToListsContainingSeries,
  filmsFromCollection,
  findMovieId,
} from "./catalog";
import { replaceSeriesKeywords, saveMovieKeywords } from "./keywords";
import { execute, HttpError, queryRows } from "./neon";
import { asId, asRecord, requireTitle, runtimeOf, seriesTitle, tmdbJson, yearFrom } from "./tmdb";

export interface TmdbImportResult {
  added: number;
  id: string;
}

export async function importMovie(connectionString: string, tmdbId: number): Promise<TmdbImportResult> {
  const movie = await tmdbJson(`/movie/${tmdbId}`);
  const title = requireTitle(movie.title);
  const year = yearFrom(movie.release_date);
  const collection = asRecord(movie.belongs_to_collection);
  const collectionId = asId(collection);
  if (collectionId) {
    await queueHorrorCollection(connectionString, collectionId);
  }

  const seriesName = collection ? seriesTitle(String(collection.name ?? "")) : "";
  const seriesId = seriesName ? await findSeriesId(connectionString, seriesName) : undefined;
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

export async function importSeries(connectionString: string, collectionId: number): Promise<TmdbImportResult> {
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
    // Older catalogs can still match series by title.
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

export async function ensureImportSchema(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS catalog_import (
        id TEXT PRIMARY KEY,
        cursor JSONB NOT NULL,
        added INTEGER NOT NULL DEFAULT 0,
        skipped INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS catalog_import_collection (
        tmdbid INTEGER PRIMARY KEY,
        queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        imported_at TIMESTAMPTZ
      )`,
  );
}

export async function queueHorrorCollection(connectionString: string, tmdbId: number): Promise<void> {
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return;
  }

  await ensureImportSchema(connectionString);
  await execute(
    connectionString,
    `INSERT INTO catalog_import_collection (tmdbid)
     VALUES ($1)
     ON CONFLICT (tmdbid) DO NOTHING`,
    [tmdbId],
  );
}

async function findSeriesId(connectionString: string, title: string): Promise<number | undefined> {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movieseries WHERE lower(title) = lower($1) LIMIT 1",
    [title],
  );
  return asId(rows[0]);
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
    throw new HttpError("Could not save that series.", 500);
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
