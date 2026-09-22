export const runtime = "nodejs";
export const maxDuration = 30;

const MEDIA_KINDS = ["movie", "series", "documentary", "show", "book", "podcast", "game"] as const;

interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json({ ids: await loadCompletedIds(connectionString, user) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as { id?: string; completed?: boolean };
    const { kind, mediaId } = parseCatalogId(body.id);
    if (body.completed) {
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, media_kind, media_id)
         DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [user.id, kind, mediaId],
      );
    } else {
      await execute(
        connectionString,
        "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = $2 AND media_id = $3",
        [user.id, kind, mediaId],
      );
    }

    if (kind === "series") {
      await cascadeSeriesMovies(connectionString, user.id, mediaId, Boolean(body.completed));
    } else if (kind === "movie") {
      await syncSeriesForMovie(connectionString, user.id, mediaId);
    }

    return Response.json({ ids: await loadCompletedIds(connectionString, user) });
  } catch (error) {
    return jsonError(error);
  }
}

async function cascadeSeriesMovies(connectionString: string, userId: number, seriesId: number, completed: boolean): Promise<void> {
  try {
    if (completed) {
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
         SELECT $1, 'movie', id, NOW()
         FROM movie
         WHERE seriesid = $2
         ON CONFLICT (user_id, media_kind, media_id)
         DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [userId, seriesId],
      );
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

async function syncSeriesForMovie(connectionString: string, userId: number, movieId: number): Promise<void> {
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
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
         VALUES ($1, 'series', $2, NOW())
         ON CONFLICT (user_id, media_kind, media_id)
         DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [userId, seriesId],
      );
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

function asId(row: Record<string, unknown> | undefined, key: string): number | undefined {
  const id = Number(row?.[key]);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

async function loadCompletedIds(connectionString: string, user: SessionUser): Promise<string[]> {
  await seedAdminProgressIfNeeded(connectionString, user);
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id FROM user_media_progress WHERE user_id = $1",
    [user.id],
  );
  return rows.map((row) => `${String(row.media_kind)}:${Number(row.media_id)}`);
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

class LibraryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requireUser(request: Request, connectionString: string): Promise<SessionUser> {
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

async function ensureUserLibrarySchema(connectionString: string): Promise<void> {
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
  try {
    await execute(
      connectionString,
      "CREATE UNIQUE INDEX IF NOT EXISTS user_list_user_name_idx ON user_list (user_id, (lower(name)))",
    );
  } catch {
    // Neon HTTP may reject expression indexes.
  }
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

function parseCatalogId(id: string | null | undefined): { kind: string; mediaId: number } {
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

function requireDatabaseUrl(): string {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new LibraryError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
}

async function queryRows(
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

async function execute(connectionString: string, query: string, params: unknown[] = []): Promise<void> {
  await neonRequest(connectionString, query, params);
}

function jsonError(error: unknown): Response {
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
