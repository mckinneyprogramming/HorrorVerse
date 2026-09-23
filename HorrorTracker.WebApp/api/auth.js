/* Generated from api-src. Edit api-src and lib, then run npm run bundle-api. */


// lib/neon.ts
var SESSION_COOKIE = "hv_session";
var HttpError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
function readSessionToken(request) {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return void 0;
  }
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }
    if (part.slice(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return void 0;
}
async function queryRows(connectionString, query, params = []) {
  const payload = await neonRequest(connectionString, query, params);
  if (!isNeonRows(payload)) {
    throw new Error("Neon HTTP response did not include rows.");
  }
  return payload.rows;
}
async function execute(connectionString, query, params = []) {
  await neonRequest(connectionString, query, params);
}
function requireDatabaseUrl() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new HttpError("DATABASE_URL is not configured.", 503);
  }
  return connectionString;
}
function resolveDatabaseUrl() {
  const fromUrl = process.env.DATABASE_URL?.trim();
  if (fromUrl) {
    return toHttpDriverUrl(fromUrl);
  }
  const horrorVerseDb = process.env.HorrorVerseDb?.trim();
  if (!horrorVerseDb) {
    return void 0;
  }
  if (/^postgres(ql)?:\/\//i.test(horrorVerseDb)) {
    return toHttpDriverUrl(horrorVerseDb);
  }
  return toHttpDriverUrl(npgsqlToUri(horrorVerseDb));
}
function jsonError(error, options) {
  console.error(options.log, error);
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("not configured")) {
    return Response.json({ error: options.unavailable ?? options.fallback }, { status: 503 });
  }
  return Response.json({ error: options.fallback }, { status: 500 });
}
async function neonRequest(connectionString, query, params) {
  const url = new URL(connectionString);
  const response = await fetch(`https://${url.hostname}/sql`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "neon-connection-string": connectionString
    },
    body: JSON.stringify({ query, params })
  });
  const payload = await response.json().catch(() => void 0);
  if (!response.ok) {
    throw new Error(neonErrorMessage(payload, response.status));
  }
  return payload;
}
function neonErrorMessage(payload, status) {
  if (payload && typeof payload === "object" && "message" in payload) {
    return String(payload.message);
  }
  return `Neon HTTP ${status}`;
}
function isNeonRows(payload) {
  return typeof payload === "object" && payload !== null && "rows" in payload && Array.isArray(payload.rows);
}
function npgsqlToUri(connectionString) {
  const values = /* @__PURE__ */ new Map();
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
    throw new HttpError("HorrorVerseDb is missing Host or Username.", 503);
  }
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgresql://${auth}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}
function toHttpDriverUrl(connectionString) {
  const normalized = connectionString.replace(/^postgres:/i, "postgresql:");
  const url = new URL(normalized);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.set("sslmode", "require");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

// api-src/auth.ts
var runtime = "nodejs";
var maxDuration = 30;
var SESSION_DAYS = 30;
var PBKDF2_ITERATIONS = 1e5;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const user = await readSessionUser(connectionString, readSessionToken(request));
    return Response.json({ user });
  } catch (error) {
    return jsonError(error, { log: "Auth request failed.", fallback: "Account unavailable." });
  }
}
async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action ?? "login").trim().toLowerCase();
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const session = action === "register" ? await registerUser(connectionString, body) : await loginUser(connectionString, body);
    return Response.json(
      { user: session.user },
      { headers: { "set-cookie": createSessionCookie(session.token, request, SESSION_DAYS) } }
    );
  } catch (error) {
    return jsonError(error, { log: "Auth request failed.", fallback: "Account unavailable." });
  }
}
async function PATCH(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const user = await readSessionUser(connectionString, readSessionToken(request));
    if (!user) {
      throw new AuthError("Sign in to continue.", 401);
    }
    const body = await request.json().catch(() => ({}));
    const displayName = body.displayName === void 0 ? user.displayName : normalizeDisplayName(body.displayName, user.email);
    if (!displayName) {
      throw new AuthError("Enter a display name.", 400);
    }
    const aboutMe = body.aboutMe === void 0 ? user.aboutMe ?? null : normalizeAboutMe(body.aboutMe);
    const avatar = body.avatar === void 0 ? user.avatar ?? null : normalizeAvatar(body.avatar);
    const rows = await queryRows(
      connectionString,
      `UPDATE app_user
       SET display_name = $1, about_me = $2, avatar = $3
       WHERE id = $4
       RETURNING id, email, display_name, is_admin, about_me, avatar`,
      [displayName, aboutMe, avatar, user.id]
    );
    const next = mapUser(rows[0]);
    if (!next) {
      throw new AuthError("Could not save the profile.", 500);
    }
    return Response.json({ user: next });
  } catch (error) {
    return jsonError(error, { log: "Auth request failed.", fallback: "Account unavailable." });
  }
}
async function DELETE(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureSchema(connectionString);
    const token = readSessionToken(request);
    if (token) {
      await execute(connectionString, "DELETE FROM app_session WHERE token = $1", [token]);
    }
    return Response.json(
      { user: null },
      { headers: { "set-cookie": createSessionCookie("", request, 0) } }
    );
  } catch (error) {
    return jsonError(error, { log: "Auth request failed.", fallback: "Account unavailable." });
  }
}
async function registerUser(connectionString, body) {
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  const displayName = normalizeDisplayName(body.displayName, email);
  validateCredentials(email, password);
  try {
    const rows = await queryRows(
      connectionString,
      `INSERT INTO app_user (email, display_name, password_hash, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, is_admin, about_me, avatar`,
      [email, displayName, await hashPassword(password), isAdminEmail(email)]
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
async function loginUser(connectionString, body) {
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  validateCredentials(email, password);
  const rows = await queryRows(
    connectionString,
    "SELECT id, email, display_name, is_admin, about_me, avatar, password_hash FROM app_user WHERE email = $1",
    [email]
  );
  const row = rows[0];
  if (!row || !await verifyPassword(password, String(row.password_hash ?? ""))) {
    throw new AuthError("Invalid email or password.", 401);
  }
  const user = await syncAdmin(connectionString, mapUser(row));
  if (!user) {
    throw new AuthError("Invalid email or password.", 401);
  }
  return { user, token: await createSession(connectionString, user.id) };
}
async function readSessionUser(connectionString, token) {
  if (!token) {
    return null;
  }
  const rows = await queryRows(
    connectionString,
    `SELECT u.id, u.email, u.display_name, u.is_admin, u.about_me, u.avatar
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return syncAdmin(connectionString, mapUser(rows[0]));
}
async function createSession(connectionString, userId) {
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3).toISOString();
  await execute(
    connectionString,
    "INSERT INTO app_session (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );
  return token;
}
async function syncAdmin(connectionString, user) {
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
function isAdminEmail(email) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  return Boolean(adminEmail) && email === adminEmail.toLowerCase();
}
async function ensureSchema(connectionString) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS app_user (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS app_session (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )`
  );
  await execute(connectionString, "CREATE INDEX IF NOT EXISTS app_session_user_id_idx ON app_session (user_id)");
  await execute(
    connectionString,
    "CREATE INDEX IF NOT EXISTS app_session_expires_at_idx ON app_session (expires_at)"
  );
  await execute(connectionString, "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS about_me TEXT");
  await execute(connectionString, "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar TEXT");
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(hash)}`;
}
async function verifyPassword(password, stored) {
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
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}
function timingSafeEqual(left, right) {
  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}
function bufferToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function base64ToBuffer(value) {
  return new Uint8Array(Buffer.from(value, "base64"));
}
function mapUser(row) {
  if (!row) {
    return null;
  }
  const aboutMe = String(row.about_me ?? row.aboutMe ?? "").trim();
  const avatar = String(row.avatar ?? "").trim();
  return {
    id: Number(row.id),
    email: String(row.email ?? ""),
    displayName: String(row.display_name ?? row.displayName ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin),
    ...aboutMe ? { aboutMe } : {},
    ...avatar ? { avatar } : {}
  };
}
function normalizeAboutMe(aboutMe) {
  const trimmed = (aboutMe ?? "").trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 500);
}
function normalizeAvatar(avatar) {
  const trimmed = (avatar ?? "").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 12e4) {
    throw new AuthError("Choose a smaller profile photo.", 400);
  }
  if (!trimmed.startsWith("data:image/jpeg;base64,") && !trimmed.startsWith("data:image/png;base64,") && !trimmed.startsWith("data:image/webp;base64,")) {
    throw new AuthError("Use a JPEG, PNG, or WebP photo.", 400);
  }
  return trimmed;
}
function normalizeEmail(email) {
  return (email ?? "").trim().toLowerCase();
}
function normalizeDisplayName(displayName, email) {
  const trimmed = (displayName ?? "").trim();
  if (trimmed) {
    return trimmed.slice(0, 80);
  }
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : "Horror fan";
}
function validateCredentials(email, password) {
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
function createSessionCookie(token, request, days) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  if (days <= 0) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }
  const maxAge = days * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function isSecureRequest(request) {
  if (process.env.VERCEL === "1") {
    return true;
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0].trim() === "https";
  }
  return new URL(request.url).protocol === "https:";
}
var AuthError = class extends HttpError {
};
export {
  DELETE,
  GET,
  PATCH,
  POST,
  maxDuration,
  runtime
};
