import { execute, queryRows } from "./neon";
import { asId, tmdbJson } from "./tmdb";

const TABLES: Record<string, { table: string; tmdbKind: "movie" | "tv" | "collection" }> = {
  movie: { table: "movie", tmdbKind: "movie" },
  documentary: { table: "documentary", tmdbKind: "movie" },
  show: { table: "show", tmdbKind: "tv" },
  series: { table: "movieseries", tmdbKind: "collection" },
};

const POSTER_BATCH = 8;

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

export async function ensurePosterSchema(connectionString: string): Promise<void> {
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
  const target = TABLES[kind];
  if (!path || !target || !Number.isInteger(mediaId) || mediaId < 1) {
    return;
  }

  await ensurePosterSchema(connectionString);
  await execute(connectionString, `UPDATE ${target.table} SET posterpath = $1 WHERE id = $2`, [path, mediaId]);
}

export async function fillMissingPosters(connectionString: string): Promise<number> {
  await ensurePosterSchema(connectionString);
  let filled = 0;
  for (const [kind, target] of Object.entries(TABLES)) {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await queryRows(
        connectionString,
        `SELECT id, tmdbid FROM ${target.table}
         WHERE tmdbid IS NOT NULL
           AND (posterpath IS NULL OR posterpath = '')
         ORDER BY id
         LIMIT $1`,
        [POSTER_BATCH],
      );
    } catch {
      continue;
    }

    for (const row of rows) {
      const mediaId = asId(row);
      const tmdbId = asId(row, "tmdbid");
      if (!mediaId || !tmdbId) {
        continue;
      }

      try {
        const payload = await tmdbJson(`/${target.tmdbKind}/${tmdbId}`);
        await savePoster(connectionString, kind, mediaId, payload.poster_path);
        if (parsePosterPath(payload.poster_path)) {
          filled += 1;
        }
      } catch {
        // Keep filling the rest of the vault if one title cannot be matched.
      }
    }
  }

  return filled;
}
