export const runtime = "nodejs";
export const maxDuration = 60;

import {
  addMovieToFranchisesContainingSeries,
  addMovieToListsContainingSeries,
  ensureShowTmdbId,
  filmsFromCollection,
  findMovieId,
  upsertShowSeasons,
} from "../lib/catalog";
import {
  ensureKeywordSchema,
  hasKeywords,
  replaceSeriesKeywords,
  saveDocumentaryKeywords,
  saveMovieKeywords,
  saveShowKeywords,
} from "../lib/keywords";
import {
  execute,
  HttpError,
  jsonError,
  queryRows,
  requireDatabaseUrl,
  requireSessionUser,
} from "../lib/neon";
import {
  asId,
  asResults,
  collectionIsHorrorAdjacent,
  seriesTitle,
  tmdbJson,
  yearFrom,
} from "../lib/tmdb";

const STALE_HOURS = 6;

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const cron = isTrustedCron(request);
    const user = cron ? undefined : await requireSessionUser(request, connectionString);
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
    if (!force && !(await isVaultStale(connectionString))) {
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

async function syncOne(connectionString: string, id: string): Promise<number> {
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

async function syncAllSeries(connectionString: string): Promise<number> {
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
      // Keep refreshing the rest of the vault if one series cannot be matched.
    }
  }

  return added;
}

async function syncAllShows(connectionString: string): Promise<number> {
  let rows: Record<string, unknown>[] = [];
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
      // Keep refreshing the rest of the vault if one show cannot be matched.
    }
  }

  return added;
}

async function syncSeries(connectionString: string, seriesId: number): Promise<number> {
  const existing = await queryRows(connectionString, "SELECT id, title, tmdbid FROM movieseries WHERE id = $1", [seriesId]);
  if (!existing[0]) {
    throw new SyncError("That series was not found.", 400);
  }

  const title = String(existing[0].title ?? "").trim();
  const collectionId = asId(existing[0], "tmdbid") ?? (await resolveSeriesTmdbId(title));
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
        [seriesId, existingId],
      );
      await saveMovieKeywords(connectionString, existingId, film.tmdbId, true);
      continue;
    }

    const movieId = asId(
      (
        await queryRows(
          connectionString,
          "INSERT INTO movie (title, totaltime, partofseries, seriesid, releaseyear, watched) VALUES ($1, $2, TRUE, $3, $4, FALSE) RETURNING id",
          [film.title, film.runtime, seriesId, film.year ?? 0],
        )
      )[0],
    );
    if (movieId) {
      await addMovieToListsContainingSeries(connectionString, seriesId, movieId);
      await addMovieToFranchisesContainingSeries(connectionString, seriesId, movieId);
      await invalidateSeriesCompletion(connectionString, seriesId);
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
    [seriesId],
  );
  await replaceSeriesKeywords(connectionString, seriesId);
  return added;
}

async function resolveSeriesTmdbId(title: string): Promise<number | undefined> {
  if (title.length < 2) {
    return undefined;
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

  return undefined;
}

async function syncShow(connectionString: string, showId: number): Promise<number> {
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

async function refreshShowSeasons(connectionString: string, showId: number, tmdbId: number): Promise<number> {
  const before = new Set(
    (await queryRows(connectionString, "SELECT season_number FROM show_season WHERE show_id = $1", [showId])).map((row) =>
      Number(row.season_number),
    ),
  );
  const show = await tmdbJson(`/tv/${tmdbId}`);
  await upsertShowSeasons(connectionString, showId, show);
  await updateShowTotals(connectionString, showId, show);
  const after = (await queryRows(connectionString, "SELECT season_number FROM show_season WHERE show_id = $1", [showId])).map(
    (row) => Number(row.season_number),
  );
  const added = after.filter((number) => Number.isInteger(number) && !before.has(number)).length;
  if (added > 0) {
    await invalidateShowCompletion(connectionString, showId);
  }

  await saveShowKeywords(connectionString, showId, tmdbId, true);
  return added;
}

async function updateShowTotals(connectionString: string, showId: number, show: Record<string, unknown>): Promise<void> {
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const seasons = Math.max(Number(show.number_of_seasons) || 0, 0);
  const runtimes = Array.isArray(show.episode_run_time) ? show.episode_run_time.map(Number) : [];
  const episodeMinutes = runtimes.find((value) => value > 0) ?? 0;
  const totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
  await execute(
    connectionString,
    "UPDATE show SET totalepisodes = $1, numberofseasons = $2, totaltime = $3, releaseyear = COALESCE(NULLIF($5, 0), releaseyear) WHERE id = $4",
    [episodes, seasons, totalTime, showId, yearFrom(show.first_air_date) ?? 0],
  );
}

async function ensureShowSchema(connectionString: string): Promise<void> {
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
    )`,
  );
}

async function ensureSeriesSchema(connectionString: string): Promise<void> {
  await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS catalog_sync (
      id INTEGER PRIMARY KEY,
      last_synced_at TIMESTAMPTZ NOT NULL
    )`,
  );
}

async function isVaultStale(connectionString: string): Promise<boolean> {
  try {
    const rows = await queryRows(connectionString, "SELECT last_synced_at FROM catalog_sync WHERE id = 1");
    const value = rows[0]?.last_synced_at;
    if (!value) {
      return true;
    }

    const synced = new Date(String(value)).getTime();
    return !Number.isFinite(synced) || Date.now() - synced > STALE_HOURS * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

async function markVaultSynced(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `INSERT INTO catalog_sync (id, last_synced_at)
     VALUES (1, NOW())
     ON CONFLICT (id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at`,
  );
}

async function invalidateSeriesCompletion(connectionString: string, seriesId: number): Promise<void> {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'series' AND media_id = $1", [seriesId]);
  } catch {
    // Progress table is created on first signed-in use.
  }
}

async function refreshMissingKeywords(connectionString: string, id?: string): Promise<number> {
  await ensureKeywordSchema(connectionString);
  const parts = (id ?? "").split(":");
  const onlyKind = parts[0] || undefined;
  const onlyId = Number(parts[1]);
  const scopedId = Number.isInteger(onlyId) && onlyId > 0 ? onlyId : undefined;
  let added = 0;

  if (!onlyKind || onlyKind === "movie" || onlyKind === "series") {
    const movies = await queryRows(connectionString, "SELECT id, title, releaseyear, tmdbid FROM movie ORDER BY id");
    for (const row of movies) {
      const movieId = asId(row);
      if (!movieId || (scopedId && onlyKind === "movie" && movieId !== scopedId)) {
        continue;
      }

      try {
        if (await hasKeywords(connectionString, "movie", movieId)) {
          continue;
        }

        const tmdbId = asId(row, "tmdbid") ?? (await resolveMovieTmdbId(String(row.title ?? ""), yearFrom(row.releaseyear)));
        if (!tmdbId) {
          continue;
        }

        await saveMovieKeywords(connectionString, movieId, tmdbId);
        added += 1;
      } catch {
        // Keep tagging the rest of the vault if one title cannot be matched.
      }
    }
  }

  if (!onlyKind || onlyKind === "documentary") {
    const docs = await queryRows(connectionString, "SELECT id, title, releaseyear, tmdbid FROM documentary ORDER BY id");
    for (const row of docs) {
      const documentaryId = asId(row);
      if (!documentaryId || (scopedId && documentaryId !== scopedId)) {
        continue;
      }

      try {
        if (await hasKeywords(connectionString, "documentary", documentaryId)) {
          continue;
        }

        const tmdbId = asId(row, "tmdbid") ?? (await resolveMovieTmdbId(String(row.title ?? ""), yearFrom(row.releaseyear)));
        if (!tmdbId) {
          continue;
        }

        await saveDocumentaryKeywords(connectionString, documentaryId, tmdbId);
        added += 1;
      } catch {
        // Keep tagging the rest of the vault if one title cannot be matched.
      }
    }
  }

  if (!onlyKind || onlyKind === "show") {
    const shows = await queryRows(connectionString, "SELECT id, tmdbid FROM show ORDER BY id");
    for (const row of shows) {
      const showId = asId(row);
      if (!showId || (scopedId && showId !== scopedId)) {
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
        // Keep tagging the rest of the vault if one title cannot be matched.
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

async function resolveMovieTmdbId(title: string, year: number | undefined): Promise<number | undefined> {
  if (title.length < 2) {
    return undefined;
  }

  const payload = await tmdbJson(`/search/movie?query=${encodeURIComponent(title)}&include_adult=false`);
  const matches = asResults(payload).filter(
    (item) => String(item.title ?? "").trim().toLowerCase() === title.toLowerCase(),
  );
  const match =
    year !== undefined
      ? matches.find((item) => yearFrom(item.release_date) === year) ?? matches[0]
      : matches[0];
  const tmdbId = Number(match?.id);
  return Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : undefined;
}

async function invalidateShowCompletion(connectionString: string, showId: number): Promise<void> {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'show' AND media_id = $1", [showId]);
  } catch {
    // Progress table is created on first signed-in use.
  }
}

function isTrustedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (secret) {
    return authorization === `Bearer ${secret}`;
  }

  return request.headers.get("x-vercel-cron") === "1";
}

class SyncError extends HttpError {}
