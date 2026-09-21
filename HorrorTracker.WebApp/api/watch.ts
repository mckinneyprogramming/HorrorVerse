export const runtime = "nodejs";
export const maxDuration = 20;

const TMDB_BASE = "https://api.themoviedb.org/3";
const REGION = "US";
const ATTRIBUTION = "JustWatch";

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireUser(request, connectionString);
    const id = new URL(request.url).searchParams.get("id");
    return Response.json(await loadWatch(connectionString, id));
  } catch (error) {
    return jsonError(error);
  }
}

async function loadWatch(connectionString: string, id: string | null): Promise<WatchOffer> {
  const { kind, mediaId } = parseId(id);
  if (kind !== "movie" && kind !== "documentary" && kind !== "show") {
    throw new WatchError(
      kind === "series" ? "Open a movie in the series to see where it is streaming." : "Streaming is only available for movies, documentaries, and TV shows.",
      400,
    );
  }

  const target = await readTarget(connectionString, kind, mediaId);
  if (!target) {
    throw new WatchError("That title was not found.", 404);
  }

  const tmdbKind = kind === "show" ? "tv" : "movie";
  const tmdbId = target.tmdbId ?? (await resolveTmdbId(tmdbKind, target.title, target.year));
  if (!tmdbId) {
    throw new WatchError("No TMDb match for this title yet.", 404);
  }

  if (!target.tmdbId) {
    await saveTmdbId(connectionString, kind, mediaId, tmdbId);
  }

  return mapProviders(target.title, await tmdbJson(`/${tmdbKind}/${tmdbId}/watch/providers`));
}

async function readTarget(connectionString: string, kind: string, mediaId: number): Promise<WatchTarget | undefined> {
  const sql =
    kind === "movie"
      ? "SELECT title, releaseyear, tmdbid FROM movie WHERE id = $1"
      : kind === "documentary"
        ? "SELECT title, releaseyear, tmdbid FROM documentary WHERE id = $1"
        : "SELECT title, NULL AS releaseyear, tmdbid FROM show WHERE id = $1";
  const row = (await queryRows(connectionString, sql, [mediaId]))[0];
  if (!row) {
    return undefined;
  }

  const title = String(row.title ?? "").trim();
  if (!title) {
    return undefined;
  }

  return {
    title,
    year: yearFrom(row.releaseyear),
    tmdbId: asId(row.tmdbid),
  };
}

async function saveTmdbId(connectionString: string, kind: string, mediaId: number, tmdbId: number): Promise<void> {
  const sql =
    kind === "movie"
      ? "UPDATE movie SET tmdbid = $1 WHERE id = $2"
      : kind === "documentary"
        ? "UPDATE documentary SET tmdbid = $1 WHERE id = $2"
        : "UPDATE show SET tmdbid = $1 WHERE id = $2";
  await execute(connectionString, sql, [tmdbId, mediaId]);
}

async function resolveTmdbId(tmdbKind: "movie" | "tv", title: string, year?: number): Promise<number | undefined> {
  if (title.length < 2) {
    return undefined;
  }

  const query = `/search/${tmdbKind}?query=${encodeURIComponent(title)}&include_adult=false${
    tmdbKind === "movie" && year ? `&year=${year}` : ""
  }`;
  const payload = await tmdbJson(query);
  const matches = asResults(payload)
    .map((item) => {
      const name = String(item[tmdbKind === "tv" ? "name" : "title"] ?? "").trim();
      const id = asId(item.id);
      if (!id || !name || name.toLowerCase() !== title.toLowerCase()) {
        return undefined;
      }

      return { id, year: yearFrom(item[tmdbKind === "tv" ? "first_air_date" : "release_date"]) };
    })
    .filter((item): item is { id: number; year?: number } => Boolean(item));

  return (year ? matches.find((item) => item.year === year) : undefined)?.id ?? matches[0]?.id;
}

function mapProviders(title: string, payload: Record<string, unknown>): WatchOffer {
  const results = asRecord(payload.results);
  const region = asRecord(results?.[REGION]);
  if (!region) {
    return { title, region: REGION, streaming: [], rent: [], buy: [], free: [], attribution: ATTRIBUTION };
  }

  const link = String(region.link ?? "").trim();
  return {
    title,
    region: REGION,
    ...(link ? { link } : {}),
    streaming: readProviders(region.flatrate),
    rent: readProviders(region.rent),
    buy: readProviders(region.buy),
    free: readProviders(region.free, region.ads),
    attribution: ATTRIBUTION,
  };
}

function readProviders(...groups: unknown[]): WatchProvider[] {
  const seen = new Set<number>();
  const items: { priority: number; provider: WatchProvider }[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const value of group) {
      const item = asRecord(value);
      if (!item) {
        continue;
      }

      const id = asId(item.provider_id);
      const name = String(item.provider_name ?? "").trim();
      if (!id || !name || seen.has(id)) {
        continue;
      }

      seen.add(id);
      const logo = logoUrl(String(item.logo_path ?? "").trim());
      const priority = Number(item.display_priority);
      items.push({
        priority: Number.isFinite(priority) ? priority : 100,
        provider: { name, ...(logo ? { logo } : {}) },
      });
    }
  }

  return items.sort((left, right) => left.priority - right.priority).map((item) => item.provider);
}

function logoUrl(path: string): string | undefined {
  if (!path) {
    return undefined;
  }

  return path.startsWith("/") ? `https://image.tmdb.org/t/p/w45${path}` : path;
}

function parseId(id: string | null): { kind: string; mediaId: number } {
  const parts = (id ?? "").split(":");
  const kind = (parts[0] ?? "").trim().toLowerCase();
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new WatchError("That title was not found.", 404);
  }

  if (kind !== "movie" && kind !== "series" && kind !== "documentary" && kind !== "show" && kind !== "book") {
    throw new WatchError("That title was not found.", 404);
  }

  return { kind, mediaId };
}

async function tmdbJson(path: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.TMDBKey?.trim();
  if (!apiKey) {
    throw new WatchError("TMDBKey is not configured.", 503);
  }

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new WatchError("Could not reach TMDb.", response.status === 401 ? 503 : 502);
  }

  return payload;
}

async function requireUser(request: Request, connectionString: string): Promise<void> {
  const token = readSessionToken(request);
  if (!token) {
    throw new WatchError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    `SELECT u.id
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  if (!rows[0]) {
    throw new WatchError("Sign in to continue.", 401);
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

    if (part.slice(0, separator).trim() === "hv_session") {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
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

function requireDatabaseUrl(): string {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new WatchError("DATABASE_URL is not configured.", 503);
  }

  return connectionString;
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

function asResults(payload: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(payload.results) ? payload.results.filter((item) => item && typeof item === "object") : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asId(value: unknown): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function yearFrom(value: unknown): number | undefined {
  const text = String(value ?? "");
  const year = Number(text.slice(0, 4));
  return Number.isInteger(year) && year >= 1888 && year <= 3000 ? year : undefined;
}

function jsonError(error: unknown): Response {
  console.error("Watch request failed.", error);
  if (error instanceof WatchError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("not configured")) {
    return Response.json({ error: message }, { status: 503 });
  }

  return Response.json({ error: "Could not look up where to watch." }, { status: 500 });
}

class WatchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface WatchTarget {
  title: string;
  year?: number;
  tmdbId?: number;
}

interface WatchProvider {
  name: string;
  logo?: string;
}

interface WatchOffer {
  title: string;
  region: string;
  link?: string;
  streaming: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  free: WatchProvider[];
  attribution: string;
}
