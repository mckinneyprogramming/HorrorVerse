export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_KINDS = ["movie", "series", "show", "book", "game"] as const;

interface FranchiseWriteBody {
  id?: number;
  franchiseId?: number;
  name?: string;
  itemId?: string;
}

export async function GET() {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureFranchiseSchema(connectionString);
    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as FranchiseWriteBody;
    if (body.itemId) {
      await addItem(connectionString, body);
    } else {
      await createFranchise(connectionString, body.name);
    }

    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as FranchiseWriteBody;
    await renameFranchise(connectionString, body.id ?? body.franchiseId, body.name);
    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const url = new URL(request.url);
    if (url.searchParams.get("itemId")) {
      await removeItem(connectionString, Number(url.searchParams.get("franchiseId") ?? url.searchParams.get("id")), url.searchParams.get("itemId"));
    } else {
      await deleteFranchise(connectionString, Number(url.searchParams.get("id")));
    }

    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error);
  }
}

async function loadFranchises(connectionString: string) {
  const rows = await queryRows(
    connectionString,
    `SELECT f.id, f.name, i.media_kind, i.media_id
     FROM franchise f
     LEFT JOIN franchise_item i ON i.franchise_id = f.id
     ORDER BY lower(f.name), f.id, i.added_at, i.media_kind, i.media_id`,
  );

  const franchises: { id: number; name: string; items: string[] }[] = [];
  const indexById = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.id);
    let index = indexById.get(id);
    if (index === undefined) {
      index = franchises.length;
      indexById.set(id, index);
      franchises.push({ id, name: String(row.name ?? ""), items: [] });
    }

    if (row.media_kind == null || row.media_id == null) {
      continue;
    }

    franchises[index].items.push(`${String(row.media_kind)}:${Number(row.media_id)}`);
  }

  return franchises;
}

async function createFranchise(connectionString: string, name: string | undefined): Promise<void> {
  const trimmed = normalizeName(name);
  const countRows = await queryRows(connectionString, "SELECT COUNT(*)::int AS count FROM franchise");
  if (Number(countRows[0]?.count) >= 80) {
    throw new FranchiseError("The vault already has 80 franchises.", 400);
  }

  try {
    await execute(connectionString, "INSERT INTO franchise (name) VALUES ($1)", [trimmed]);
  } catch (error) {
    throw duplicateNameError(error);
  }
}

async function renameFranchise(connectionString: string, franchiseId: number | undefined, name: string | undefined): Promise<void> {
  const id = requireFranchiseId(franchiseId);
  const trimmed = normalizeName(name);
  try {
    const rows = await queryRows(connectionString, "UPDATE franchise SET name = $1 WHERE id = $2 RETURNING id", [trimmed, id]);
    if (rows.length < 1) {
      throw new FranchiseError("That franchise was not found.", 400);
    }
  } catch (error) {
    throw duplicateNameError(error);
  }
}

async function deleteFranchise(connectionString: string, franchiseId: number): Promise<void> {
  const id = requireFranchiseId(franchiseId);
  const rows = await queryRows(connectionString, "DELETE FROM franchise WHERE id = $1 RETURNING id", [id]);
  if (rows.length < 1) {
    throw new FranchiseError("That franchise was not found.", 400);
  }
}

async function addItem(connectionString: string, body: FranchiseWriteBody): Promise<void> {
  const franchiseId = await requireExisting(connectionString, body.franchiseId ?? body.id);
  const { kind, mediaId } = parseCatalogId(body.itemId);
  const countRows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM franchise_item WHERE franchise_id = $1",
    [franchiseId],
  );
  if (Number(countRows[0]?.count) >= 200) {
    throw new FranchiseError("That franchise is full.", 400);
  }

  await execute(
    connectionString,
    `INSERT INTO franchise_item (franchise_id, media_kind, media_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (franchise_id, media_kind, media_id) DO NOTHING`,
    [franchiseId, kind, mediaId],
  );
  if (kind === "series") {
    await addSeriesMovies(connectionString, franchiseId, mediaId);
  }
}

async function removeItem(connectionString: string, franchiseId: number, itemId: string | null): Promise<void> {
  const id = await requireExisting(connectionString, franchiseId);
  const { kind, mediaId } = parseCatalogId(itemId);
  await execute(
    connectionString,
    "DELETE FROM franchise_item WHERE franchise_id = $1 AND media_kind = $2 AND media_id = $3",
    [id, kind, mediaId],
  );
  if (kind === "series") {
    await removeSeriesMovies(connectionString, id, mediaId);
  }
}

async function addSeriesMovies(connectionString: string, franchiseId: number, seriesId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `INSERT INTO franchise_item (franchise_id, media_kind, media_id)
       SELECT $1, 'movie', id
       FROM movie
       WHERE seriesid = $2
       ON CONFLICT DO NOTHING`,
      [franchiseId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function removeSeriesMovies(connectionString: string, franchiseId: number, seriesId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `DELETE FROM franchise_item
       WHERE franchise_id = $1
         AND media_kind = 'movie'
         AND media_id IN (SELECT id FROM movie WHERE seriesid = $2)`,
      [franchiseId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function requireExisting(connectionString: string, franchiseId: number | undefined): Promise<number> {
  const id = requireFranchiseId(franchiseId);
  const rows = await queryRows(connectionString, "SELECT 1 FROM franchise WHERE id = $1", [id]);
  if (rows.length < 1) {
    throw new FranchiseError("That franchise was not found.", 400);
  }

  return id;
}

function requireFranchiseId(id: number | undefined): number {
  if (!Number.isInteger(id) || Number(id) < 1) {
    throw new FranchiseError("That franchise was not found.", 400);
  }

  return Number(id);
}

function normalizeName(name: string | undefined): string {
  const value = (name ?? "").trim();
  if (value.length < 1 || value.length > 80) {
    throw new FranchiseError("Enter a franchise name.", 400);
  }

  return value;
}

function parseCatalogId(id: string | null | undefined): { kind: string; mediaId: number } {
  const parts = (id ?? "").split(":");
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new FranchiseError("That title was not found.", 400);
  }

  const kind = parts[0].trim().toLowerCase();
  if (!ALLOWED_KINDS.includes(kind as (typeof ALLOWED_KINDS)[number])) {
    throw new FranchiseError("Franchises can hold series, movies, shows, and books.", 400);
  }

  return { kind, mediaId };
}

function duplicateNameError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("franchise_name_idx") || message.includes("duplicate key")) {
    return new FranchiseError("A franchise with that name already exists.", 400);
  }

  return error instanceof Error ? error : new Error("Could not save that franchise.");
}

async function requireAdmin(request: Request, connectionString: string): Promise<void> {
  await ensureFranchiseSchema(connectionString);
  const token = readSessionToken(request);
  if (!token) {
    throw new FranchiseError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    `SELECT u.email, u.is_admin
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  const row = rows[0];
  if (!row) {
    throw new FranchiseError("Sign in to continue.", 401);
  }

  const email = String(row.email ?? "").toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isAdmin = Boolean(row.is_admin ?? row.isAdmin) || Boolean(adminEmail && email === adminEmail);
  if (!isAdmin) {
    throw new FranchiseError("Only the administrator can change franchises.", 403);
  }
}

async function ensureFranchiseSchema(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS franchise (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  );
  try {
    await execute(connectionString, "CREATE UNIQUE INDEX IF NOT EXISTS franchise_name_idx ON franchise (lower(name))");
  } catch {
    // Neon HTTP may reject expression indexes; duplicate names are still checked on insert.
  }
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS franchise_item (
        franchise_id INTEGER NOT NULL REFERENCES franchise(id) ON DELETE CASCADE,
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (franchise_id, media_kind, media_id)
      )`,
  );
}

class FranchiseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function requireDatabaseUrl(): string {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new FranchiseError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
}

async function queryRows(connectionString: string, query: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
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
  console.error("Franchise request failed.", error);
  if (error instanceof FranchiseError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("not configured")) {
    return Response.json({ error: message }, { status: 503 });
  }

  return Response.json({ error: "Could not update franchises." }, { status: 500 });
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
  return typeof payload === "object" && payload !== null && "rows" in payload && Array.isArray((payload as { rows: unknown }).rows);
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
