export const runtime = "nodejs";
export const maxDuration = 30;

interface CatalogItem {
  id: string;
  mediaId: number;
  title: string;
  kind: string;
  completed: boolean;
}

export async function GET() {
  try {
    return Response.json(await loadCatalog());
  } catch (error) {
    console.error("Catalog request failed.", error);
    const message = error instanceof Error ? error.message : "";
    const status = message.includes("not configured") ? 503 : 500;
    return Response.json({ error: "Catalog unavailable." }, { status });
  }
}

async function loadCatalog(): Promise<CatalogItem[]> {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return [
    ...(await readTable(connectionString, "SELECT id, title, watched AS completed FROM movie", "movie")),
    ...(await readTable(connectionString, "SELECT id, title, watched AS completed FROM movieseries", "series")),
    ...(await readTable(connectionString, "SELECT id, title, watched AS completed FROM documentary", "documentary")),
    ...(await readOptional(connectionString, "SELECT id, title, watched AS completed FROM show", "show")),
    ...(await readOptional(connectionString, "SELECT id, title, read AS completed FROM book", "book")),
  ];
}

async function readTable(
  connectionString: string,
  query: string,
  kind: string,
): Promise<CatalogItem[]> {
  return mapRows(await queryRows(connectionString, query), kind);
}

async function readOptional(
  connectionString: string,
  query: string,
  kind: string,
): Promise<CatalogItem[]> {
  try {
    return await readTable(connectionString, query, kind);
  } catch (error) {
    console.error(`Optional catalog table ${kind} is unavailable.`, error);
    return [];
  }
}

async function queryRows(
  connectionString: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const url = new URL(connectionString);
  const response = await fetch(`https://${url.hostname}/sql`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "neon-connection-string": connectionString,
    },
    body: JSON.stringify({ query, params: [] }),
  });

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(neonErrorMessage(payload, response.status));
  }

  if (!isNeonRows(payload)) {
    throw new Error("Neon HTTP response did not include rows.");
  }

  return payload.rows;
}

function neonErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    return String((payload as { message: unknown }).message);
  }

  return `Neon HTTP ${status}`;
}

function isNeonRows(payload: unknown): payload is { rows: Record<string, unknown>[] } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "rows" in payload &&
    Array.isArray((payload as { rows: unknown }).rows)
  );
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

function resolveDatabaseUrl(): string | undefined {
  const fromUrl = process.env.DATABASE_URL?.trim();
  if (fromUrl) {
    return toHttpDriverUrl(fromUrl);
  }

  const horrorVerseDb = process.env.HorrorVerseDb?.trim();
  if (!horrorVerseDb) {
    return undefined;
  }

  if (/^postgres(ql)?:\/\//i.test(horrorVerseDb)) {
    return toHttpDriverUrl(horrorVerseDb);
  }

  return toHttpDriverUrl(npgsqlToUri(horrorVerseDb));
}

function npgsqlToUri(connectionString: string): string {
  const values = new Map<string, string>();
  for (const part of connectionString.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }

    values.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }

  const host = values.get("host");
  const user = values.get("username") ?? values.get("user");
  const password = values.get("password") ?? "";
  const database = values.get("database") ?? "HorrorTracker";
  if (!host || !user) {
    throw new Error("HorrorVerseDb is missing Host or Username.");
  }

  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgresql://${auth}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}

function toHttpDriverUrl(connectionString: string): string {
  const normalized = connectionString.replace(/^postgres:/i, "postgresql:");
  const url = new URL(normalized);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.set("sslmode", "require");
  url.searchParams.delete("channel_binding");
  return url.toString();
}
