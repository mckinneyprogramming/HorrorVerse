export const runtime = "nodejs";
export const maxDuration = 30;

import { LIBRARY_MEDIA_KINDS, parseCatalogId } from "../lib/catalog-id";
import { parseWatchYear, watchTimestamp, yearFromCompletedAt } from "../lib/watch-year";
import { postersForCatalogIds } from "../lib/poster";
import { loadReadNext, loadWatchNext, type WatchNextItem } from "../lib/watch-next";
import { asId } from "../lib/tmdb";
import {
  ensureUserLibrarySchema,
  execute,
  HttpError,
  jsonError as neonJsonError,
  queryRows,
  requireDatabaseUrl,
  requireSessionUser,
  type SessionUser,
} from "../lib/neon";

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json(await loadProgress(connectionString, user));
  } catch (error) {
    return neonJsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as { id?: string; completed?: boolean; dated?: boolean; year?: number; score?: number | null };
    const { kind, mediaId } = parseCatalogId(body.id, LIBRARY_MEDIA_KINDS);
    if ("score" in body) {
      await setTitleScore(connectionString, user.id, kind, mediaId, body.score);
      return Response.json(await loadProgress(connectionString, user));
    }

    const dated = body.dated !== false;
    const year = dated ? parseWatchYear(body.year) : undefined;
    if (body.completed) {
      await upsertProgress(connectionString, user.id, kind, mediaId, dated, year);
    } else {
      await execute(
        connectionString,
        "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = $2 AND media_id = $3",
        [user.id, kind, mediaId],
      );
    }

    if (kind === "series") {
      await cascadeSeriesMovies(connectionString, user.id, mediaId, Boolean(body.completed), dated, year);
    } else if (kind === "movie") {
      await syncSeriesForMovie(connectionString, user.id, mediaId, dated, year);
    }

    return Response.json(await loadProgress(connectionString, user));
  } catch (error) {
    return neonJsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}

async function setTitleScore(
  connectionString: string,
  userId: number,
  kind: string,
  mediaId: number,
  value: unknown,
): Promise<void> {
  await ensureUserLibrarySchema(connectionString);
  const score = value == null || value === "" ? null : Number(value);
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
    throw new HttpError("Score a finished title from 1 to 5.", 400);
  }

  const rows = await queryRows(
    connectionString,
    `UPDATE user_media_progress
     SET score = $4
     WHERE user_id = $1 AND media_kind = $2 AND media_id = $3
     RETURNING media_id`,
    [userId, kind, mediaId, score],
  );
  if (rows.length < 1) {
    throw new HttpError("Mark that title finished before scoring it.", 400);
  }
}

async function upsertProgress(
  connectionString: string,
  userId: number,
  kind: string,
  mediaId: number,
  dated: boolean,
  year?: number,
): Promise<void> {
  if (!dated) {
    await execute(
      connectionString,
      `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (user_id, media_kind, media_id)
       DO UPDATE SET completed_at = EXCLUDED.completed_at`,
      [userId, kind, mediaId],
    );
    return;
  }

  if (year) {
    await execute(
      connectionString,
      `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       ON CONFLICT (user_id, media_kind, media_id)
       DO UPDATE SET completed_at = EXCLUDED.completed_at`,
      [userId, kind, mediaId, watchTimestamp(year)],
    );
    return;
  }

  await execute(
    connectionString,
    `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, media_kind, media_id)
     DO UPDATE SET completed_at = EXCLUDED.completed_at`,
    [userId, kind, mediaId],
  );
}

async function cascadeSeriesMovies(
  connectionString: string,
  userId: number,
  seriesId: number,
  completed: boolean,
  dated: boolean,
  year?: number,
): Promise<void> {
  try {
    if (completed) {
      const movies = await queryRows(connectionString, "SELECT id FROM movie WHERE seriesid = $1", [seriesId]);
      for (const row of movies) {
        const movieId = asId(row);
        if (movieId) {
          await upsertProgress(connectionString, userId, "movie", movieId, dated, year);
        }
      }
      return;
    }

    await execute(
      connectionString,
      `DELETE FROM user_media_progress
       WHERE user_id = $1
         AND media_kind = 'movie'
         AND media_id IN (SELECT id FROM movie WHERE seriesid = $2)`,
      [userId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function syncSeriesForMovie(
  connectionString: string,
  userId: number,
  movieId: number,
  dated: boolean,
  year?: number,
): Promise<void> {
  try {
    const seriesId = asId((await queryRows(connectionString, "SELECT seriesid FROM movie WHERE id = $1", [movieId]))[0], "seriesid");
    if (!seriesId) {
      return;
    }

    const rows = await queryRows(
      connectionString,
      `SELECT
         (SELECT COUNT(*)::int FROM movie WHERE seriesid = $2) AS total,
         (SELECT COUNT(*)::int FROM user_media_progress p
          JOIN movie m ON m.id = p.media_id
          WHERE p.user_id = $1 AND p.media_kind = 'movie' AND m.seriesid = $2) AS finished`,
      [userId, seriesId],
    );
    const total = Number(rows[0]?.total) || 0;
    const finished = Number(rows[0]?.finished) || 0;
    if (total > 0 && finished >= total) {
      await upsertProgress(connectionString, userId, "series", seriesId, dated, year);
      return;
    }

    await execute(
      connectionString,
      "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = 'series' AND media_id = $2",
      [userId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function loadProgress(
  connectionString: string,
  user: SessionUser,
): Promise<{
  ids: string[];
  recentIds: string[];
  undatedIds: string[];
  watchedYears: Record<string, number>;
  scores: Record<string, number>;
  recentPosters: Record<string, string>;
  watchNext: WatchNextItem[];
}> {
  await seedAdminProgressIfNeeded(connectionString, user);
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id, completed_at, score FROM user_media_progress WHERE user_id = $1",
    [user.id],
  );
  const recent = await queryRows(
    connectionString,
    `SELECT media_kind, media_id FROM user_media_progress
     WHERE user_id = $1 AND completed_at IS NOT NULL
     ORDER BY completed_at DESC, media_kind, media_id
     LIMIT 48`,
    [user.id],
  );
  const watchedYears: Record<string, number> = {};
  const scores: Record<string, number> = {};
  for (const row of rows) {
    const id = progressId(row);
    const year = yearFromCompletedAt(row.completed_at);
    if (year) {
      watchedYears[id] = year;
    }

    const score = Number(row.score);
    if (Number.isInteger(score) && score >= 1 && score <= 5) {
      scores[id] = score;
    }
  }

  const recentIds = recent.map(progressId);
  const [watchNext, readNext] = await Promise.all([
    loadWatchNext(connectionString, user.id).catch(() => []),
    loadReadNext(connectionString, user.id).catch(() => []),
  ]);
  const homePosters = await postersForCatalogIds(connectionString, [
    ...recentIds.slice(0, 8),
    ...watchNext.map((item) => item.id),
    ...readNext.map((item) => item.id),
  ]);
  return {
    ids: rows.map(progressId),
    recentIds,
    undatedIds: rows.filter((row) => row.completed_at == null).map(progressId),
    watchedYears,
    scores,
    recentPosters: Object.fromEntries(recentIds.flatMap((id) => (homePosters[id] ? [[id, homePosters[id]]] : []))),
    watchNext: withHomePoster(watchNext, homePosters),
    readNext: withHomePoster(readNext, homePosters),
  };
}

function withHomePoster(items: WatchNextItem[], homePosters: Record<string, string>): WatchNextItem[] {
  return items.map((item) => {
    const posterPath = item.posterPath ?? homePosters[item.id];
    return posterPath && !item.posterPath ? { ...item, posterPath } : item;
  });
}

function progressId(row: Record<string, unknown>): string {
  return `${String(row.media_kind)}:${Number(row.media_id)}`;
}

async function seedAdminProgressIfNeeded(connectionString: string, user: SessionUser): Promise<void> {
  if (!user.isAdmin) {
    return;
  }

  const seeded = await queryRows(connectionString, "SELECT 1 FROM user_progress_seed WHERE user_id = $1", [user.id]);
  if (seeded.length > 0) {
    return;
  }

  const copies = [
    "SELECT $1, 'movie', id FROM movie WHERE watched",
    "SELECT $1, 'series', id FROM movieseries WHERE watched",
    "SELECT $1, 'documentary', id FROM documentary WHERE watched",
    "SELECT $1, 'show', id FROM show WHERE watched",
    "SELECT $1, 'book', id FROM book WHERE read",
  ];

  for (const selectSql of copies) {
    try {
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id)
         ${selectSql}
         ON CONFLICT DO NOTHING`,
        [user.id],
      );
    } catch {
      // Optional catalog tables may not exist yet.
    }
  }

  await execute(
    connectionString,
    "INSERT INTO user_progress_seed (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    [user.id],
  );
}

class LibraryError extends HttpError {}

async function requireUser(request: Request, connectionString: string): Promise<SessionUser> {
  await ensureUserLibrarySchema(connectionString);
  return requireSessionUser(request, connectionString);
}

