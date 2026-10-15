import { execute, HttpError, queryRows } from "./neon";
import { asId, tmdbJsonOptional } from "./tmdb";

const TABLES: Record<string, { table: string; tmdbKind: "movie" | "tv" | "collection" }> = {
  movie: { table: "movie", tmdbKind: "movie" },
  documentary: { table: "documentary", tmdbKind: "movie" },
  show: { table: "show", tmdbKind: "tv" },
  series: { table: "movieseries", tmdbKind: "collection" },
};

const POSTER_BATCH = 48;
const POSTER_CONCURRENCY = 8;
const NO_POSTER = "-";
const POSTER_SIZES = new Set(["w92", "w185", "w342", "w500", "w780"]);
const MAX_POSTER_BYTES = 8 * 1024 * 1024;

let posterSchema: Promise<void> | undefined;
let posterSchemaKey = "";

export function parsePosterPath(value: unknown): string | undefined {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.length > 160 || path.includes("..") || /[^A-Za-z0-9._/-]/.test(path)) {
    return undefined;
  }

  return path;
}

export function posterUrl(path: string | undefined, size = "w92"): string | undefined {
  const parsed = parsePosterPath(path);
  if (!parsed) {
    return undefined;
  }

  return `https://image.tmdb.org/t/p/${size}${parsed}`;
}

export function posterSize(value: unknown): string {
  const size = String(value ?? "").trim();
  return POSTER_SIZES.has(size) ? size : "w500";
}

export async function proxyTmdbPoster(path: unknown, size: unknown): Promise<Response> {
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
      "cache-control": "private, max-age=86400",
    },
  });
}

export async function ensurePosterSchema(connectionString: string): Promise<void> {
  if (!posterSchema || posterSchemaKey !== connectionString) {
    posterSchemaKey = connectionString;
    posterSchema = applyPosterSchema(connectionString).catch((error: unknown) => {
      posterSchema = undefined;
      throw error;
    });
  }

  await posterSchema;
}

async function applyPosterSchema(connectionString: string): Promise<void> {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS posterpath TEXT");
  await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS posterpath TEXT");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS posterpath TEXT");
  try {
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS posterpath TEXT");
  } catch {
    // Show table is created on first TV import.
  }
}

export async function savePoster(
  connectionString: string,
  kind: string,
  mediaId: number,
  value: unknown,
): Promise<void> {
  const path = parsePosterPath(value);
  if (!path) {
    return;
  }

  await writePosterValue(connectionString, kind, mediaId, path);
}

export async function fillMissingPosters(connectionString: string, budgetMs = 18_000): Promise<number> {
  await ensurePosterSchema(connectionString);
  const deadline = Date.now() + Math.max(budgetMs, 0);
  let filled = 0;
  for (const [kind, target] of Object.entries(TABLES)) {
    if (Date.now() >= deadline) {
      break;
    }

    const rows = await loadMissingPosterRows(connectionString, kind, target.table);
    for (let index = 0; index < rows.length; index += POSTER_CONCURRENCY) {
      if (Date.now() >= deadline) {
        break;
      }

      const chunk = rows.slice(index, index + POSTER_CONCURRENCY);
      const saved = await Promise.all(chunk.map((row) => fillOnePoster(connectionString, kind, target.tmdbKind, row)));
      filled += saved.filter(Boolean).length;
    }
  }

  return filled;
}

export async function postersForRecentProgress(
  connectionString: string,
  userId: number,
): Promise<Record<string, string>> {
  if (!Number.isInteger(userId) || userId < 1) {
    return {};
  }

  await ensurePosterSchema(connectionString);
  let rows: Record<string, unknown>[] = [];
  try {
    rows = await queryRows(
      connectionString,
      `SELECT media_kind, media_id FROM user_media_progress
       WHERE user_id = $1 AND completed_at IS NOT NULL
       ORDER BY completed_at DESC, media_kind, media_id
       LIMIT 8`,
      [userId],
    );
  } catch {
    return {};
  }

  const posters: Record<string, string> = {};
  await Promise.all(
    rows.map(async (row) => {
      const kind = String(row.media_kind ?? "");
      const mediaId = asId(row, "media_id");
      const target = TABLES[kind];
      if (!mediaId || !target || kind === "series") {
        return;
      }

      try {
        const existing = await queryRows(
          connectionString,
          `SELECT tmdbid, posterpath FROM ${target.table} WHERE id = $1`,
          [mediaId],
        );
        const current = parsePosterPath(existing[0]?.posterpath);
        if (current) {
          posters[`${kind}:${mediaId}`] = current;
          return;
        }

        const tmdbId = asId(existing[0], "tmdbid");
        if (!tmdbId) {
          return;
        }

        const payload = await tmdbJsonOptional(`/${target.tmdbKind}/${tmdbId}`);
        const path = parsePosterPath(payload?.poster_path);
        await writePosterValue(connectionString, kind, mediaId, path ?? NO_POSTER);
        if (path) {
          posters[`${kind}:${mediaId}`] = path;
        }
      } catch {
        // Recents still render titles if one poster cannot be matched.
      }
    }),
  );

  return posters;
}

async function loadMissingPosterRows(
  connectionString: string,
  kind: string,
  table: string,
): Promise<Record<string, unknown>[]> {
  try {
    return await queryRows(
      connectionString,
      `SELECT t.id, t.tmdbid FROM ${table} t
       WHERE t.tmdbid IS NOT NULL
         AND (t.posterpath IS NULL OR t.posterpath = '')
       ORDER BY (
         SELECT MAX(p.completed_at) FROM user_media_progress p
         WHERE p.media_kind = $2 AND p.media_id = t.id
       ) DESC NULLS LAST, t.id
       LIMIT $1`,
      [POSTER_BATCH, kind],
    );
  } catch {
    try {
      return await queryRows(
        connectionString,
        `SELECT id, tmdbid FROM ${table}
         WHERE tmdbid IS NOT NULL
           AND (posterpath IS NULL OR posterpath = '')
         ORDER BY id
         LIMIT $1`,
        [POSTER_BATCH],
      );
    } catch {
      return [];
    }
  }
}

async function fillOnePoster(
  connectionString: string,
  kind: string,
  tmdbKind: "movie" | "tv" | "collection",
  row: Record<string, unknown>,
): Promise<boolean> {
  const mediaId = asId(row);
  const tmdbId = asId(row, "tmdbid");
  if (!mediaId || !tmdbId) {
    return false;
  }

  try {
    const payload = await tmdbJsonOptional(`/${tmdbKind}/${tmdbId}`);
    if (!payload) {
      await writePosterValue(connectionString, kind, mediaId, NO_POSTER);
      return false;
    }

    const path = parsePosterPath(payload.poster_path);
    await writePosterValue(connectionString, kind, mediaId, path ?? NO_POSTER);
    return Boolean(path);
  } catch {
    return false;
  }
}

async function writePosterValue(
  connectionString: string,
  kind: string,
  mediaId: number,
  value: string,
): Promise<void> {
  const target = TABLES[kind];
  if (!target || !Number.isInteger(mediaId) || mediaId < 1) {
    return;
  }

  await ensurePosterSchema(connectionString);
  await execute(connectionString, `UPDATE ${target.table} SET posterpath = $1 WHERE id = $2`, [value, mediaId]);
}
