export const runtime = "nodejs";
export const maxDuration = 30;

const MEDIA_KINDS = ["movie", "series", "documentary", "show", "book", "podcast", "game"] as const;

interface ListWriteBody {
  id?: number;
  listId?: number;
  name?: string;
  itemId?: string;
}

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as ListWriteBody;
    if (body.itemId) {
      await addListItem(connectionString, user.id, body);
    } else {
      await createList(connectionString, user.id, body.name);
    }

    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as ListWriteBody;
    await renameList(connectionString, user.id, body.id ?? body.listId, body.name);
    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const url = new URL(request.url);
    if (url.searchParams.get("itemId")) {
      await removeListItem(connectionString, user.id, Number(url.searchParams.get("listId")), url.searchParams.get("itemId"));
    } else {
      await deleteList(connectionString, user.id, Number(url.searchParams.get("id")));
    }

    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

async function loadLists(connectionString: string, userId: number) {
  const rows = await queryRows(
    connectionString,
    `SELECT l.id, l.name, i.media_kind, i.media_id
     FROM user_list l
     LEFT JOIN user_list_item i ON i.list_id = l.id
     WHERE l.user_id = $1
     ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id`,
    [userId],
  );

  const lists: { id: number; name: string; items: string[] }[] = [];
  const indexById = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.id);
    let index = indexById.get(id);
    if (index === undefined) {
      index = lists.length;
      indexById.set(id, index);
      lists.push({ id, name: String(row.name ?? ""), items: [] });
    }

    const kind = row.media_kind;
    const mediaId = row.media_id;
    if (kind == null || mediaId == null) {
      continue;
    }

    lists[index].items.push(`${String(kind)}:${Number(mediaId)}`);
  }

  return lists;
}

async function createList(connectionString: string, userId: number, name: string | undefined): Promise<void> {
  const trimmed = normalizeListName(name);
  const countRows = await queryRows(connectionString, "SELECT COUNT(*)::int AS count FROM user_list WHERE user_id = $1", [
    userId,
  ]);
  if (Number(countRows[0]?.count) >= 40) {
    throw new LibraryError("You already have 40 lists.", 400);
  }

  try {
    await execute(connectionString, "INSERT INTO user_list (user_id, name) VALUES ($1, $2)", [userId, trimmed]);
  } catch (error) {
    throw duplicateListError(error);
  }
}

async function renameList(
  connectionString: string,
  userId: number,
  listId: number | undefined,
  name: string | undefined,
): Promise<void> {
  const id = requireListId(listId);
  const trimmed = normalizeListName(name);
  try {
    const rows = await queryRows(
      connectionString,
      "UPDATE user_list SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
      [trimmed, id, userId],
    );
    if (rows.length < 1) {
      throw new LibraryError("That list was not found.", 400);
    }
  } catch (error) {
    throw duplicateListError(error);
  }
}

async function deleteList(connectionString: string, userId: number, listId: number): Promise<void> {
  const id = requireListId(listId);
  const rows = await queryRows(connectionString, "DELETE FROM user_list WHERE id = $1 AND user_id = $2 RETURNING id", [
    id,
    userId,
  ]);
  if (rows.length < 1) {
    throw new LibraryError("That list was not found.", 400);
  }
}

async function addListItem(connectionString: string, userId: number, body: ListWriteBody): Promise<void> {
  const listId = await requireOwnedList(connectionString, userId, body.listId ?? body.id);
  const { kind, mediaId } = parseCatalogId(body.itemId);
  const countRows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM user_list_item WHERE list_id = $1",
    [listId],
  );
  if (Number(countRows[0]?.count) >= 200) {
    throw new LibraryError("That list is full.", 400);
  }

  await execute(
    connectionString,
    `INSERT INTO user_list_item (list_id, media_kind, media_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (list_id, media_kind, media_id) DO NOTHING`,
    [listId, kind, mediaId],
  );
}

async function removeListItem(
  connectionString: string,
  userId: number,
  listId: number,
  itemId: string | null,
): Promise<void> {
  const ownedListId = await requireOwnedList(connectionString, userId, listId);
  const { kind, mediaId } = parseCatalogId(itemId);
  await execute(
    connectionString,
    "DELETE FROM user_list_item WHERE list_id = $1 AND media_kind = $2 AND media_id = $3",
    [ownedListId, kind, mediaId],
  );
}

async function requireOwnedList(connectionString: string, userId: number, listId: number | undefined): Promise<number> {
  const id = requireListId(listId);
  const rows = await queryRows(connectionString, "SELECT 1 FROM user_list WHERE id = $1 AND user_id = $2", [id, userId]);
  if (rows.length < 1) {
    throw new LibraryError("That list was not found.", 400);
  }

  return id;
}

function requireListId(id: number | undefined): number {
  if (!Number.isInteger(id) || Number(id) < 1) {
    throw new LibraryError("That list was not found.", 400);
  }

  return Number(id);
}

function normalizeListName(name: string | undefined): string {
  const value = (name ?? "").trim();
  if (value.length < 1 || value.length > 80) {
    throw new LibraryError("Enter a list name.", 400);
  }

  return value;
}

function duplicateListError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("user_list_user_name_idx") || message.includes("duplicate key")) {
    return new LibraryError("You already have a list with that name.", 400);
  }

  return error instanceof Error ? error : new Error("Could not save that list.");
}

class LibraryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
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
    // Neon HTTP may reject expression indexes; duplicate names are still checked on insert.
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
