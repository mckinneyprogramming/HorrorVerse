import { execute, queryRows } from "./neon";
import { asId, asRecord, asResults, runtimeOf, tmdbJson, yearFrom } from "./tmdb";

export interface CollectionFilm {
  tmdbId: number;
  title: string;
  year?: number;
  runtime: number;
}

export async function filmsFromCollection(collection: Record<string, unknown>): Promise<CollectionFilm[]> {
  const parts = Array.isArray(collection.parts) ? collection.parts : [];
  const films: CollectionFilm[] = [];
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
      runtime: runtimeOf(film.runtime),
    });
  }

  return films;
}

export async function findMovieId(
  connectionString: string,
  title: string,
  year: number | undefined,
): Promise<number | undefined> {
  const rows = await queryRows(
    connectionString,
    "SELECT id FROM movie WHERE lower(title) = lower($1) AND releaseyear = $2 LIMIT 1",
    [title, year ?? 0],
  );
  return asId(rows[0]);
}

export async function addMovieToListsContainingSeries(
  connectionString: string,
  seriesId: number,
  movieId: number,
): Promise<void> {
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

export async function addMovieToFranchisesContainingSeries(
  connectionString: string,
  seriesId: number,
  movieId: number,
): Promise<void> {
  try {
    await execute(
      connectionString,
      `INSERT INTO franchise_item (franchise_id, media_kind, media_id)
       SELECT franchise_id, 'movie', $1
       FROM franchise_item
       WHERE media_kind = 'series' AND media_id = $2
       ON CONFLICT (franchise_id, media_kind, media_id) DO NOTHING`,
      [movieId, seriesId],
    );
  } catch {
    // Franchise tables are created on first franchise read.
  }
}

export async function ensureShowTmdbId(connectionString: string, showId: number): Promise<number | undefined> {
  const existing = asId((await queryRows(connectionString, "SELECT tmdbid FROM show WHERE id = $1", [showId]))[0], "tmdbid");
  if (existing) {
    return existing;
  }

  const row = (await queryRows(connectionString, "SELECT title, releaseyear FROM show WHERE id = $1", [showId]))[0];
  const title = String(row?.title ?? "").trim();
  if (title.length < 2) {
    return undefined;
  }

  const year = yearFrom(row?.releaseyear);
  const results = asResults(await tmdbJson(`/search/tv?query=${encodeURIComponent(title)}&include_adult=false`));
  const sameTitle = results.filter((item) => String(item.name ?? "").trim().toLowerCase() === title.toLowerCase());
  const match =
    (year ? sameTitle.find((item) => yearFrom(item.first_air_date) === year) : undefined) ?? sameTitle[0] ?? results[0];
  const tmdbId = Number(match?.id);
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return undefined;
  }

  await execute(connectionString, "UPDATE show SET tmdbid = $1 WHERE id = $2", [tmdbId, showId]);
  return tmdbId;
}

export async function upsertShowSeasons(
  connectionString: string,
  showId: number,
  show: Record<string, unknown>,
): Promise<void> {
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
      [showId, number, title],
    );
  }
}
