import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "./database-url";

export interface CatalogItem {
  id: string;
  mediaId: number;
  title: string;
  kind: string;
  completed: boolean;
}

export async function loadCatalog(kind?: string): Promise<CatalogItem[]> {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = neon(connectionString);
  const items = [
    ...(await readRequired(() => sql`SELECT id, title, watched AS completed FROM movie`, "movie")),
    ...(await readRequired(() => sql`SELECT id, title, watched AS completed FROM movieseries`, "series")),
    ...(await readRequired(() => sql`SELECT id, title, watched AS completed FROM documentary`, "documentary")),
    ...(await readOptional(() => sql`SELECT id, title, watched AS completed FROM show`, "show")),
    ...(await readOptional(() => sql`SELECT id, title, read AS completed FROM book`, "book")),
  ];

  if (!kind) {
    return items;
  }

  return items.filter((item) => item.kind.toLowerCase() === kind.toLowerCase());
}

async function readRequired(
  query: () => Promise<Record<string, unknown>[]>,
  kind: string,
): Promise<CatalogItem[]> {
  return mapRows(await query(), kind);
}

async function readOptional(
  query: () => Promise<Record<string, unknown>[]>,
  kind: string,
): Promise<CatalogItem[]> {
  try {
    return mapRows(await query(), kind);
  } catch {
    return [];
  }
}

function mapRows(rows: Record<string, unknown>[], kind: string): CatalogItem[] {
  return rows.map((row) => {
    const mediaId = Number(row.id);
    return {
      id: `${kind}:${mediaId}`,
      mediaId,
      title: String(row.title ?? ""),
      kind,
      completed: Boolean(row.completed),
    };
  });
}
