export const runtime = "nodejs";
export const maxDuration = 30;

const SESSION_COOKIE = "hv_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

interface AuthRequestBody {
  action?: string;
  email?: string;
  password?: string;
  displayName?: string;
}

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const user = await readSessionUser(connectionString, readSessionToken(request));
    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AuthRequestBody;
    const action = (body.action ?? "login").trim().toLowerCase();
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const session =
      action === "register"
        ? await registerUser(connectionString, body)
        : await loginUser(connectionString, body);
    return Response.json(
      { user: session.user },
      { headers: { "set-cookie": createSessionCookie(session.token, request, SESSION_DAYS) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const token = readSessionToken(request);
    if (token) {
      await execute(connectionString, "DELETE FROM app_session WHERE token = $1", [token]);
    }

    return Response.json(
      { user: null },
      { headers: { "set-cookie": createSessionCookie("", request, 0) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

async function registerUser(
  connectionString: string,
  body: AuthRequestBody,
): Promise<{ user: AuthUser; token: string }> {
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  const displayName = normalizeDisplayName(body.displayName, email);
  validateCredentials(email, password);

  try {
    const rows = await queryRows(
      connectionString,
      `INSERT INTO app_user (email, display_name, password_hash, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, is_admin`,
      [email, displayName, await hashPassword(password), isAdminEmail(email)],
    );
    const user = mapUser(rows[0]);
    if (!user) {
      throw new AuthError("Could not create the account.", 500);
    }

    return { user, token: await createSession(connectionString, user.id) };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "";
    if (/duplicate|unique/i.test(message)) {
      throw new AuthError("An account with that email already exists.", 409);
    }

    throw error;
  }
}

async function loginUser(
  connectionString: string,
  body: AuthRequestBody,
): Promise<{ user: AuthUser; token: string }> {
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  validateCredentials(email, password);

  const rows = await queryRows(
    connectionString,
    "SELECT id, email, display_name, is_admin, password_hash FROM app_user WHERE email = $1",
    [email],
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, String(row.password_hash ?? "")))) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const user = await syncAdmin(connectionString, mapUser(row));
  if (!user) {
    throw new AuthError("Invalid email or password.", 401);
  }

  return { user, token: await createSession(connectionString, user.id) };
}

async function readSessionUser(connectionString: string, token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const rows = await queryRows(
    connectionString,
    `SELECT u.id, u.email, u.display_name, u.is_admin
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  return syncAdmin(connectionString, mapUser(rows[0]));
}

async function createSession(connectionString: string, userId: number): Promise<string> {
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await execute(
    connectionString,
    "INSERT INTO app_session (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt],
  );
  return token;
}

async function syncAdmin(connectionString: string, user: AuthUser | null): Promise<AuthUser | null> {
  if (!user) {
    return null;
  }

  const isAdmin = isAdminEmail(user.email);
  if (isAdmin === user.isAdmin) {
    return user;
  }

  await execute(connectionString, "UPDATE app_user SET is_admin = $1 WHERE id = $2", [isAdmin, user.id]);
  return { ...user, isAdmin };
}

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  return Boolean(adminEmail) && email === adminEmail.toLowerCase();
}

async function ensureSchema(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS app_user (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS app_session (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )`,
  );
  await execute(connectionString, "CREATE INDEX IF NOT EXISTS app_session_user_id_idx ON app_session (user_id)");
  await execute(
    connectionString,
    "CREATE INDEX IF NOT EXISTS app_session_expires_at_idx ON app_session (expires_at)",
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    return false;
  }

  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1) {
    return false;
  }

  try {
    const salt = base64ToBuffer(parts[3]);
    const expected = base64ToBuffer(parts[4]);
    const actual = await pbkdf2(password, salt, iterations);
    if (actual.byteLength !== expected.byteLength) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function bufferToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBuffer(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function mapUser(row: Record<string, unknown> | undefined): AuthUser | null {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    email: String(row.email ?? ""),
    displayName: String(row.display_name ?? row.displayName ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin),
  };
}

function normalizeEmail(email: string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizeDisplayName(displayName: string | undefined, email: string): string {
  const trimmed = (displayName ?? "").trim();
  if (trimmed) {
    return trimmed.slice(0, 80);
  }

  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : "Horror fan";
}

function validateCredentials(email: string, password: string): void {
  if (email.length < 3 || email.length > 254 || !email.includes("@") || !email.includes(".")) {
    throw new AuthError("Enter a valid email address.", 400);
  }

  if (password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", 400);
  }

  if (password.length > 256) {
    throw new AuthError("Password is too long.", 400);
  }
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

    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}

function createSessionCookie(token: string, request: Request, days: number): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  if (days <= 0) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  const maxAge = days * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function isSecureRequest(request: Request): boolean {
  if (process.env.VERCEL === "1") {
    return true;
  }

  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0].trim() === "https";
  }

  return new URL(request.url).protocol === "https:";
}

function requireDatabaseUrl(): string {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new AuthError("DATABASE_URL is not configured.", 503);
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
    throw new AuthError("HorrorVerseDb is missing Host or Username.", 503);
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

function jsonError(error: unknown): Response {
  console.error("Auth request failed.", error);
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "";
  const status = message.includes("not configured") ? 503 : 500;
  return Response.json({ error: "Account unavailable." }, { status });
}

class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
