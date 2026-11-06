import { execute, queryRows } from "./neon";
import { asId, tmdbJson } from "./tmdb";

const TABLES: Record<string, { table: string; tmdb: "movie" | "tv" }> = {
  movie: { table: "movie", tmdb: "movie" },
  documentary: { table: "documentary", tmdb: "movie" },
  show: { table: "show", tmdb: "tv" },
};

export function synopsisText(value: unknown): string | undefined {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return undefined;
  }

  return text.length > 4000 ? text.slice(0, 4000).trim() : text;
}

export async function storeSynopsis(
  connectionString: string,
  kind: string,
  mediaId: number,
  overview: unknown,
): Promise<void> {
  const target = TABLES[kind];
  const text = synopsisText(overview);
  if (!target || !Number.isInteger(mediaId) || mediaId < 1 || !text) {
    return;
  }

  await execute(connectionString, `ALTER TABLE ${target.table} ADD COLUMN IF NOT EXISTS description TEXT`);
  await execute(
    connectionString,
    `UPDATE ${target.table}
     SET description = $2
     WHERE id = $1 AND (description IS NULL OR btrim(description) = '')`,
    [mediaId, text],
  );
}

export async function ensureSynopsis(connectionString: string, catalogId: string): Promise<string | undefined> {
  const parsed = parseSynopsisId(catalogId);
  if (!parsed) {
    return undefined;
  }

  await execute(connectionString, `ALTER TABLE ${parsed.table} ADD COLUMN IF NOT EXISTS description TEXT`);
  const rows = await queryRows(connectionString, `SELECT description, tmdbid FROM ${parsed.table} WHERE id = $1`, [parsed.mediaId]);
  const existing = synopsisText(rows[0]?.description);
  if (existing) {
    return existing;
  }

  const tmdbId = asId(rows[0], "tmdbid");
  if (!tmdbId) {
    return undefined;
  }

  const payload = await tmdbJson(`/${parsed.tmdb}/${tmdbId}`);
  const text = synopsisText(payload.overview);
  if (!text) {
    return undefined;
  }

  await execute(connectionString, `UPDATE ${parsed.table} SET description = $2 WHERE id = $1`, [parsed.mediaId, text]);
  return text;
}

export async function ensureSynopsisColumns(connectionString: string): Promise<void> {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS description TEXT");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS description TEXT");
  try {
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS description TEXT");
  } catch {
    // The show table is created on the first TV import.
  }
}

function parseSynopsisId(catalogId: string): { table: string; tmdb: "movie" | "tv"; mediaId: number } | undefined {
  const match = /^(movie|documentary|show):([1-9]\d*)$/.exec(catalogId.trim());
  if (!match) {
    return undefined;
  }

  const target = TABLES[match[1]];
  return target ? { ...target, mediaId: Number(match[2]) } : undefined;
}
