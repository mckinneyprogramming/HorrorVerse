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
async function requireSessionUser(request, connectionString) {
  const token = readSessionToken(request);
  if (!token) {
    throw new HttpError("Sign in to continue.", 401);
  }
  const rows = await queryRows(
    connectionString,
    `SELECT u.id, u.email, u.display_name, u.is_admin
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  const row = rows[0];
  if (!row) {
    throw new HttpError("Sign in to continue.", 401);
  }
  const email = String(row.email ?? "").toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const id = Number(row.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError("Sign in to continue.", 401);
  }
  return {
    id,
    email,
    displayName: String(row.display_name ?? row.displayName ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin) || Boolean(adminEmail && email === adminEmail)
  };
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

// lib/catalog-id.ts
var LIBRARY_MEDIA_KINDS = ["movie", "series", "documentary", "show", "book", "podcast", "game"];
function parseCatalogId(id, allowed = LIBRARY_MEDIA_KINDS, notFound = "That title was not found.", status = 400) {
  const parts = (id ?? "").split(":");
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new HttpError(notFound, status);
  }
  const kind = parts[0].trim().toLowerCase();
  if (!allowed.includes(kind)) {
    throw new HttpError(notFound, status);
  }
  return { kind, mediaId };
}

// lib/tmdb.ts
var TMDB_BASE = "https://api.themoviedb.org/3";
async function tmdbJson(path) {
  const payload = await tmdbJsonOptional(path);
  if (!payload) {
    throw new HttpError("Could not reach TMDb.", 502);
  }
  return payload;
}
async function tmdbJsonOptional(path) {
  const apiKey = process.env.TMDBKey?.trim();
  if (!apiKey) {
    throw new HttpError("TMDBKey is not configured.", 503);
  }
  try {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        throw new HttpError("Could not reach TMDb.", 503);
      }
      return null;
    }
    return payload;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    return null;
  }
}
function asResults(payload) {
  return Array.isArray(payload.results) ? payload.results.filter((item) => item && typeof item === "object") : [];
}
function asRecord(value) {
  return value && typeof value === "object" ? value : void 0;
}
function asPositiveInt(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : void 0;
}
function yearFrom(value) {
  const text = String(value ?? "");
  const year = Number(text.slice(0, 4));
  return Number.isInteger(year) && year >= 1888 && year <= 3e3 ? year : void 0;
}

// api-src/watch.ts
var runtime = "nodejs";
var maxDuration = 20;
var REGION = "US";
var ATTRIBUTION = "JustWatch";
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
    const id = new URL(request.url).searchParams.get("id");
    return Response.json(await loadWatch(connectionString, id));
  } catch (error) {
    return jsonError(error, { log: "Watch request failed.", fallback: "Could not look up where to watch." });
  }
}
async function loadWatch(connectionString, id) {
  const { kind, mediaId } = parseId(id);
  if (kind !== "movie" && kind !== "documentary" && kind !== "show") {
    throw new WatchError(
      kind === "series" ? "Open a movie in the series to see where it is streaming." : "Streaming is only available for movies, documentaries, and TV shows.",
      400
    );
  }
  const target = await readTarget(connectionString, kind, mediaId);
  if (!target) {
    throw new WatchError("That title was not found.", 404);
  }
  const tmdbKind = kind === "show" ? "tv" : "movie";
  const tmdbId = target.tmdbId ?? await resolveTmdbId(tmdbKind, target.title, target.year);
  if (!tmdbId) {
    throw new WatchError("No TMDb match for this title yet.", 404);
  }
  if (!target.tmdbId) {
    await saveTmdbId(connectionString, kind, mediaId, tmdbId);
  }
  return mapProviders(target.title, await tmdbJson(`/${tmdbKind}/${tmdbId}/watch/providers`));
}
async function readTarget(connectionString, kind, mediaId) {
  const sql = kind === "movie" ? "SELECT title, releaseyear, tmdbid FROM movie WHERE id = $1" : kind === "documentary" ? "SELECT title, releaseyear, tmdbid FROM documentary WHERE id = $1" : "SELECT title, releaseyear, tmdbid FROM show WHERE id = $1";
  const row = (await queryRows(connectionString, sql, [mediaId]))[0];
  if (!row) {
    return void 0;
  }
  const title = String(row.title ?? "").trim();
  if (!title) {
    return void 0;
  }
  return {
    title,
    year: yearFrom(row.releaseyear),
    tmdbId: asPositiveInt(row.tmdbid)
  };
}
async function saveTmdbId(connectionString, kind, mediaId, tmdbId) {
  const sql = kind === "movie" ? "UPDATE movie SET tmdbid = $1 WHERE id = $2" : kind === "documentary" ? "UPDATE documentary SET tmdbid = $1 WHERE id = $2" : "UPDATE show SET tmdbid = $1 WHERE id = $2";
  await execute(connectionString, sql, [tmdbId, mediaId]);
}
async function resolveTmdbId(tmdbKind, title, year) {
  if (title.length < 2) {
    return void 0;
  }
  const query = `/search/${tmdbKind}?query=${encodeURIComponent(title)}&include_adult=false${tmdbKind === "movie" && year ? `&year=${year}` : ""}`;
  const payload = await tmdbJson(query);
  const matches = asResults(payload).map((item) => {
    const name = String(item[tmdbKind === "tv" ? "name" : "title"] ?? "").trim();
    const id = asPositiveInt(item.id);
    if (!id || !name || name.toLowerCase() !== title.toLowerCase()) {
      return void 0;
    }
    return { id, year: yearFrom(item[tmdbKind === "tv" ? "first_air_date" : "release_date"]) };
  }).filter((item) => Boolean(item));
  return (year ? matches.find((item) => item.year === year) : void 0)?.id ?? matches[0]?.id;
}
function mapProviders(title, payload) {
  const results = asRecord(payload.results);
  const region = asRecord(results?.[REGION]);
  if (!region) {
    return { title, region: REGION, streaming: [], rent: [], buy: [], free: [], attribution: ATTRIBUTION };
  }
  const link = String(region.link ?? "").trim();
  return {
    title,
    region: REGION,
    ...link ? { link } : {},
    streaming: readProviders(region.flatrate),
    rent: readProviders(region.rent),
    buy: readProviders(region.buy),
    free: readProviders(region.free, region.ads),
    attribution: ATTRIBUTION
  };
}
function readProviders(...groups) {
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  for (const group of groups) {
    if (!Array.isArray(group)) {
      continue;
    }
    for (const value of group) {
      const item = asRecord(value);
      if (!item) {
        continue;
      }
      const id = asPositiveInt(item.provider_id);
      const name = String(item.provider_name ?? "").trim();
      if (!id || !name || seen.has(id)) {
        continue;
      }
      seen.add(id);
      const logo = logoUrl(String(item.logo_path ?? "").trim());
      const priority = Number(item.display_priority);
      items.push({
        priority: Number.isFinite(priority) ? priority : 100,
        provider: { name, ...logo ? { logo } : {} }
      });
    }
  }
  return items.sort((left, right) => left.priority - right.priority).map((item) => item.provider);
}
function logoUrl(path) {
  if (!path) {
    return void 0;
  }
  return path.startsWith("/") ? `https://image.tmdb.org/t/p/w45${path}` : path;
}
function parseId(id) {
  return parseCatalogId(id, ["movie", "series", "documentary", "show", "book"], "That title was not found.", 404);
}
var WatchError = class extends HttpError {
};
export {
  GET,
  maxDuration,
  runtime
};
