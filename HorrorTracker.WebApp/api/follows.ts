export const runtime = "nodejs";
export const maxDuration = 30;

interface WriteBody {
  userId?: number;
}

export async function POST(request: Request) {
  try {
    const { connectionString, viewerId } = await openSocial(request);
    const body = (await request.json().catch(() => ({}))) as WriteBody;
    const otherId = await requireOtherUser(connectionString, viewerId, body.userId);
    await execute(connectionString, "INSERT INTO user_follow (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      viewerId,
      otherId,
    ]);
    return fetchPerson(request, otherId);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { connectionString, viewerId } = await openSocial(request);
    const otherId = await requireOtherUser(connectionString, viewerId, Number(new URL(request.url).searchParams.get("id")));
    await execute(connectionString, "DELETE FROM user_follow WHERE follower_id = $1 AND following_id = $2", [viewerId, otherId]);
    return fetchPerson(request, otherId);
  } catch (error) {
    return jsonError(error);
  }
}

async function fetchPerson(request: Request, userId: number): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = "/api/people";
  url.search = `?id=${userId}`;
  const response = await fetch(url.toString(), { headers: { cookie: request.headers.get("cookie") ?? "" } });
  const payload = await response.json().catch(() => ({}));
  return Response.json(payload, { status: response.status });
}

async function requireOtherUser(connectionString: string, viewerId: number, userId: number | undefined): Promise<number> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1 || id === viewerId) {
    throw new SocialError(id === viewerId ? "That has to be someone else." : "That member was not found.", 400);
  }

  const rows = await queryRows(connectionString, "SELECT 1 FROM app_user WHERE id = $1", [id]);
  if (rows.length < 1) {
    throw new SocialError("That member was not found.", 400);
  }

  return id;
}

async function openSocial(request: Request): Promise<{ connectionString: string; viewerId: number }> {
  const connectionString = requireDatabaseUrl();
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_follow (
      follower_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id),
      CHECK (follower_id <> following_id)
    )`,
  );
  const token = readSessionToken(request);
  if (!token) {
    throw new SocialError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    "SELECT u.id FROM app_session s JOIN app_user u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW()",
    [token],
  );
  const viewerId = Number(rows[0]?.id);
  if (!Number.isInteger(viewerId) || viewerId < 1) {
    throw new SocialError("Sign in to continue.", 401);
  }

  return { connectionString, viewerId };
}

function readSessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
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

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new SocialError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
}

async function queryRows(connectionString: string, query: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const payload = await neonRequest(connectionString, query, params);
  if (!payload || typeof payload !== "object" || !("rows" in payload) || !Array.isArray((payload as { rows: unknown }).rows)) {
    throw new Error("Neon HTTP response did not include rows.");
  }

  return (payload as { rows: Record<string, unknown>[] }).rows;
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
    throw new Error(payload && typeof payload === "object" && "message" in payload ? String((payload as { message: unknown }).message) : `Neon HTTP ${response.status}`);
  }

  return payload;
}

function jsonError(error: unknown): Response {
  if (error instanceof SocialError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: error instanceof Error ? error.message : "Could not update follow." }, { status: 500 });
}

class SocialError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
