export const MEDIA_KINDS = ["movie", "series", "documentary", "show", "book", "podcast", "game"] as const;

export class LibraryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export async function requireUser(request: Request, connectionString: string): Promise<SessionUser> {
  await ensureUserLibrarySchema(connectionString);
  const token = readSessionToken(request);
  if (!token) {
    throw new LibraryError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    `SELECT u.id, u.email, u.display_name, u.is_admin
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  const row = rows[0];
  if (!row) {
    throw new LibraryError("Sign in to continue.", 401);
  }

  const email = String(row.email ?? "").toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return {
    id: Number(row.id),
    email,
    displayName: String(row.display_name ?? row.displayName ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin) || Boolean(adminEmail && email === adminEmail),
  };
}

export async function ensureUserLibrarySchema(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_media_progress (
        user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, media_kind, media_id)
      )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_list (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  );
  await execute(connectionString, "CREATE INDEX IF NOT EXISTS user_list_user_id_idx ON user_list (user_id)");
  await execute(
    connectionString,
    "CREATE UNIQUE INDEX IF NOT EXISTS user_list_user_name_idx ON user_list (user_id, lower(name))",
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_list_item (
        list_id INTEGER NOT NULL REFERENCES user_list(id) ON DELETE CASCADE,
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (list_id, media_kind, media_id)
      )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_progress_seed (
        user_id INTEGER PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
        seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  );
}

export function parseCatalogId(id: string | null | undefined): { kind: string; mediaId: number } {
  const parts = (id ?? "").split(":");
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new LibraryError("That title was not found.", 400);
  }

  const kind = parts[0].trim().toLowerCase();
  if (!MEDIA_KINDS.includes(kind as (typeof MEDIA_KINDS)[number])) {
    throw new LibraryError("That title was not found.", 400);
  }

  return { kind, mediaId };
}

export function requireDatabaseUrl(): string {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new LibraryError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
}

export async function queryRows(
  connectionString: string,
  query: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const payload = await neonRequest(connectionString, query, params);
  if (!isNeonRows(payload)) {
    throw new Error("Neon HTTP response did not include rows.");
  }

  return payload.rows;
}

export async function execute(connectionString: string, query: string, params: unknown[] = []): Promise<void> {
  await neonRequest(connectionString, query, params);
}

export function jsonError(error: unknown): Response {
  console.error("User library request failed.", error);
  if (error instanceof LibraryError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("not configured")) {
    return Response.json({ error: "Library unavailable." }, { status: 503 });
  }

  return Response.json({ error: "Could not update your library." }, { status: 500 });
}

function readSessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return undefined;
  }

  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }

    if (part.slice(0, separator).trim() === "hv_session") {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}

async function neonRequest(connectionString: string, query: string, params: unknown[]): Promise<unknown> {
  const url = new URL(connectionString);
  const response = await fetch(`https://${url.hostname}/sql`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "neon-connection-string": connectionString,
    },
    body: JSON.stringify({ query, params }),
  });

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(neonErrorMessage(payload, response.status));
  }

  return payload;
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
    throw new LibraryError("HorrorVerseDb is missing Host or Username.", 503);
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
