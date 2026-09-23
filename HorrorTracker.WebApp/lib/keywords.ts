import { execute, queryRows } from "./neon";
import { asRecord, tmdbJson } from "./tmdb";

export async function saveMovieKeywords(
  connectionString: string,
  movieId: number,
  tmdbId: number,
  skipIfPresent = false,
): Promise<void> {
  await saveKeywords(connectionString, "movie", movieId, tmdbId, "movie", skipIfPresent);
}

export async function saveDocumentaryKeywords(
  connectionString: string,
  documentaryId: number,
  tmdbId: number,
  skipIfPresent = false,
): Promise<void> {
  await saveKeywords(connectionString, "documentary", documentaryId, tmdbId, "movie", skipIfPresent);
}

export async function saveShowKeywords(
  connectionString: string,
  showId: number,
  tmdbId: number,
  skipIfPresent = false,
): Promise<void> {
  await saveKeywords(connectionString, "show", showId, tmdbId, "tv", skipIfPresent);
}

export async function saveKeywords(
  connectionString: string,
  kind: string,
  mediaId: number,
  tmdbId: number,
  tmdbKind: "movie" | "tv",
  skipIfPresent: boolean,
): Promise<void> {
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

    if (skipIfPresent && (await hasKeywords(connectionString, kind, mediaId))) {
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
        [kind, mediaId, keywordId, name],
      );
    }
  } catch {
    // Tags are best-effort and will backfill on vault sync.
  }
}

export async function replaceSeriesKeywords(connectionString: string, seriesId: number): Promise<void> {
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
      [seriesId],
    );
  } catch {
    // Series tags are rebuilt after movie tags land.
  }
}

export async function ensureKeywordSchema(connectionString: string): Promise<void> {
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
    )`,
  );
}

export async function hasKeywords(connectionString: string, kind: string, mediaId: number): Promise<boolean> {
  const rows = await queryRows(
    connectionString,
    "SELECT 1 AS present FROM media_keyword WHERE media_kind = $1 AND media_id = $2 LIMIT 1",
    [kind, mediaId],
  );
  return Boolean(rows[0]);
}
