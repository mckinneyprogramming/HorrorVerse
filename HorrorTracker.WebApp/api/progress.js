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
async function ensureUserLibrarySchema(connectionString) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_media_progress (
        user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, media_kind, media_id)
      )`
  );
  await execute(connectionString, "ALTER TABLE user_media_progress ALTER COLUMN completed_at DROP NOT NULL");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_list (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
  );
  await execute(connectionString, "CREATE INDEX IF NOT EXISTS user_list_user_id_idx ON user_list (user_id)");
  try {
    await execute(
      connectionString,
      "CREATE UNIQUE INDEX IF NOT EXISTS user_list_user_name_idx ON user_list (user_id, (lower(name)))"
    );
  } catch {
  }
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_list_item (
        list_id INTEGER NOT NULL REFERENCES user_list(id) ON DELETE CASCADE,
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (list_id, media_kind, media_id)
      )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_progress_seed (
        user_id INTEGER PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
        seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
  );
  await execute(connectionString, "ALTER TABLE user_list ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'");
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

// lib/watch-year.ts
var FIRST_YEAR = 1888;
function parseWatchYear(value, now = /* @__PURE__ */ new Date()) {
  const year = typeof value === "number" ? value : Number(String(value ?? "").trim());
  const last = now.getUTCFullYear() + 1;
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > last) {
    return void 0;
  }
  return year;
}
function watchTimestamp(year) {
  return `${year}-07-01T12:00:00.000Z`;
}
function yearFromCompletedAt(value) {
  if (value == null || value === "") {
    return void 0;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    return void 0;
  }
  return date.getUTCFullYear();
}

// lib/tmdb.ts
var TMDB_BASE = "https://api.themoviedb.org/3";
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
function asId(row, key = "id") {
  return asPositiveInt(row?.[key]);
}
function asPositiveInt(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : void 0;
}

// lib/poster.ts
var TABLES = {
  movie: { table: "movie", tmdbKind: "movie" },
  documentary: { table: "documentary", tmdbKind: "movie" },
  show: { table: "show", tmdbKind: "tv" },
  series: { table: "movieseries", tmdbKind: "collection" }
};
var NO_POSTER = "-";
var MAX_POSTER_BYTES = 8 * 1024 * 1024;
var posterSchema;
var posterSchemaKey = "";
function parsePosterPath(value) {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.length > 160 || path.includes("..") || /[^A-Za-z0-9._/-]/.test(path)) {
    return void 0;
  }
  return path;
}
async function ensurePosterSchema(connectionString) {
  if (!posterSchema || posterSchemaKey !== connectionString) {
    posterSchemaKey = connectionString;
    posterSchema = applyPosterSchema(connectionString).catch((error) => {
      posterSchema = void 0;
      throw error;
    });
  }
  await posterSchema;
}
async function applyPosterSchema(connectionString) {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS posterpath TEXT");
  await execute(connectionString, "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS posterpath TEXT");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS posterpath TEXT");
  try {
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS posterpath TEXT");
  } catch {
  }
}
var HOME_POSTER_BUDGET_MS = 8e3;
var HOME_POSTER_CHUNK = 3;
async function postersForCatalogIds(connectionString, ids, budgetMs = HOME_POSTER_BUDGET_MS) {
  const unique = [...new Set(ids)].filter((id) => id.includes(":"));
  if (unique.length < 1) {
    return {};
  }
  await ensurePosterSchema(connectionString);
  const deadline = Date.now() + Math.max(budgetMs, 0);
  const posters = {};
  for (let index = 0; index < unique.length; index += HOME_POSTER_CHUNK) {
    if (Date.now() >= deadline) {
      break;
    }
    const chunk = unique.slice(index, index + HOME_POSTER_CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        const separator = id.indexOf(":");
        const kind = id.slice(0, separator);
        const mediaId = Number(id.slice(separator + 1));
        const path = await ensurePoster(connectionString, kind, mediaId);
        if (path) {
          posters[id] = path;
        }
      })
    );
  }
  return posters;
}
async function ensurePoster(connectionString, kind, mediaId) {
  const target = TABLES[kind];
  if (!target || kind === "series" || !Number.isInteger(mediaId) || mediaId < 1) {
    return void 0;
  }
  await ensurePosterSchema(connectionString);
  try {
    const existing = await queryRows(
      connectionString,
      `SELECT tmdbid, posterpath FROM ${target.table} WHERE id = $1`,
      [mediaId]
    );
    const current = parsePosterPath(existing[0]?.posterpath);
    if (current) {
      return current;
    }
    const tmdbId = asId(existing[0], "tmdbid");
    if (tmdbId) {
      const payload = await tmdbJsonOptional(`/${target.tmdbKind}/${tmdbId}`);
      const path = parsePosterPath(payload?.poster_path);
      await writePosterValue(connectionString, kind, mediaId, path ?? NO_POSTER);
      if (path) {
        return path;
      }
    }
    return siblingMoviePoster(connectionString, kind, mediaId);
  } catch {
    return void 0;
  }
}
async function siblingMoviePoster(connectionString, kind, mediaId) {
  if (kind !== "movie") {
    return void 0;
  }
  try {
    const rows = await queryRows(
      connectionString,
      `SELECT COALESCE(
         NULLIF(ms.posterpath, '-'),
         (
           SELECT fm.posterpath FROM movie fm
           WHERE fm.seriesid = m.seriesid
             AND fm.id <> m.id
             AND fm.posterpath IS NOT NULL
             AND fm.posterpath LIKE '/%'
           LIMIT 1
         )
       ) AS posterpath
       FROM movie m
       LEFT JOIN movieseries ms ON ms.id = m.seriesid
       WHERE m.id = $1`,
      [mediaId]
    );
    return parsePosterPath(rows[0]?.posterpath);
  } catch {
    return void 0;
  }
}
async function writePosterValue(connectionString, kind, mediaId, value) {
  const target = TABLES[kind];
  if (!target || !Number.isInteger(mediaId) || mediaId < 1) {
    return;
  }
  await ensurePosterSchema(connectionString);
  await execute(connectionString, `UPDATE ${target.table} SET posterpath = $1 WHERE id = $2`, [value, mediaId]);
}

// lib/watch-next.ts
var WATCH_NEXT_LIMIT = 6;
function dailyWatchNextSeed(userId, now = /* @__PURE__ */ new Date()) {
  return userId * 1e4 + now.getUTCFullYear() * 400 + (now.getUTCMonth() + 1) * 32 + now.getUTCDate();
}
function pickWatchNext(source, limit = WATCH_NEXT_LIMIT, seed = 0) {
  const picked = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (items) => {
    for (const item of items) {
      if (picked.length >= limit || seen.has(item.id) || !item.title) {
        continue;
      }
      seen.add(item.id);
      picked.push(item);
    }
  };
  add(source.episodes);
  add(source.series);
  add(source.listed);
  add(shuffleWithSeed(source.vault, seed));
  return picked;
}
async function loadWatchNext(connectionString, userId) {
  const [episodes, series, listed, vault] = await Promise.all([
    loadNextEpisodes(connectionString, userId),
    loadNextSeriesMovies(connectionString, userId),
    loadListedUnfinished(connectionString, userId),
    loadVaultUnfinished(connectionString, userId)
  ]);
  return pickWatchNext({ episodes, series, listed, vault }, WATCH_NEXT_LIMIT, dailyWatchNextSeed(userId));
}
async function loadNextEpisodes(connectionString, userId) {
  try {
    const rows = await queryRows(
      connectionString,
      `SELECT DISTINCT ON (s.id)
         s.id,
         s.title,
         s.posterpath,
         se.season_number,
         e.episode_number,
         e.title AS episode_title,
         (
           SELECT MAX(p.completed_at)
           FROM user_episode_progress p
           JOIN show_episode pe ON pe.id = p.episode_id
           WHERE p.user_id = $1 AND pe.show_id = s.id
         ) AS last_watched
       FROM show s
       JOIN show_episode e ON e.show_id = s.id
       JOIN show_season se ON se.id = e.season_id
       WHERE EXISTS (
         SELECT 1
         FROM user_episode_progress p
         JOIN show_episode pe ON pe.id = p.episode_id
         WHERE p.user_id = $1 AND pe.show_id = s.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM user_media_progress ump
         WHERE ump.user_id = $1 AND ump.media_kind = 'show' AND ump.media_id = s.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM user_episode_progress p2
         WHERE p2.user_id = $1 AND p2.episode_id = e.id
       )
       ORDER BY s.id, se.season_number, e.episode_number`,
      [userId]
    );
    return rows.map((row) => {
      const item = toItem("show", row.id, row.title, row.posterpath, "episode", episodeDetail(row.season_number, row.episode_number, row.episode_title));
      return item ? { item, at: Date.parse(String(row.last_watched ?? "")) || 0 } : void 0;
    }).filter((row) => row !== void 0).sort((left, right) => right.at - left.at).map((row) => row.item);
  } catch {
    return [];
  }
}
async function loadNextSeriesMovies(connectionString, userId) {
  try {
    const rows = await queryRows(
      connectionString,
      `SELECT DISTINCT ON (m.seriesid)
         m.id,
         m.title,
         COALESCE(NULLIF(m.posterpath, '-'), NULLIF(ms.posterpath, '-')) AS posterpath,
         m.releaseyear,
         ms.title AS series_title,
         (
           SELECT MAX(p.completed_at)
           FROM user_media_progress p
           JOIN movie fm ON fm.id = p.media_id
           WHERE p.user_id = $1 AND p.media_kind = 'movie' AND fm.seriesid = m.seriesid
         ) AS last_watched
       FROM movie m
       JOIN movieseries ms ON ms.id = m.seriesid
       WHERE m.seriesid IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM user_media_progress p
           JOIN movie fm ON fm.id = p.media_id
           WHERE p.user_id = $1 AND p.media_kind = 'movie' AND fm.seriesid = m.seriesid
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'movie' AND p.media_id = m.id
         )
       ORDER BY m.seriesid, m.releaseyear NULLS LAST, m.title`,
      [userId]
    );
    return rows.map((row) => {
      const item = toItem("movie", row.id, row.title, row.posterpath, "series", joinDetail(row.series_title, row.releaseyear));
      return item ? { item, at: Date.parse(String(row.last_watched ?? "")) || 0 } : void 0;
    }).filter((row) => row !== void 0).sort((left, right) => right.at - left.at).map((row) => row.item);
  } catch {
    return [];
  }
}
async function loadListedUnfinished(connectionString, userId) {
  try {
    const rows = await queryRows(
      connectionString,
      `SELECT 'movie' AS kind, m.id, m.title, m.posterpath, m.releaseyear
       FROM user_list_item i
       JOIN user_list l ON l.id = i.list_id
       JOIN movie m ON m.id = i.media_id
       WHERE l.user_id = $1 AND i.media_kind = 'movie'
         AND NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'movie' AND p.media_id = m.id
         )
       UNION ALL
       SELECT 'documentary', d.id, d.title, d.posterpath, d.releaseyear
       FROM user_list_item i
       JOIN user_list l ON l.id = i.list_id
       JOIN documentary d ON d.id = i.media_id
       WHERE l.user_id = $1 AND i.media_kind = 'documentary'
         AND NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'documentary' AND p.media_id = d.id
         )
       UNION ALL
       SELECT 'show', s.id, s.title, s.posterpath, s.releaseyear
       FROM user_list_item i
       JOIN user_list l ON l.id = i.list_id
       JOIN show s ON s.id = i.media_id
       WHERE l.user_id = $1 AND i.media_kind = 'show'
         AND NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'show' AND p.media_id = s.id
         )
       UNION ALL
       SELECT 'book', b.id, b.title, NULL, b.releaseyear
       FROM user_list_item i
       JOIN user_list l ON l.id = i.list_id
       JOIN book b ON b.id = i.media_id
       WHERE l.user_id = $1 AND i.media_kind = 'book'
         AND NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'book' AND p.media_id = b.id
         )`,
      [userId]
    );
    return rows.map((row) => toItem(row.kind, row.id, row.title, row.posterpath, "list", yearDetail(row.releaseyear))).filter((item) => item !== void 0);
  } catch {
    return [];
  }
}
async function loadVaultUnfinished(connectionString, userId) {
  try {
    const rows = await queryRows(
      connectionString,
      `(
         SELECT 'movie' AS kind, id, title, posterpath, releaseyear FROM movie m
         WHERE NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'movie' AND p.media_id = m.id
         )
         ORDER BY id
         LIMIT 20
       )
       UNION ALL
       (
         SELECT 'documentary', id, title, posterpath, releaseyear FROM documentary d
         WHERE NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'documentary' AND p.media_id = d.id
         )
         ORDER BY id
         LIMIT 20
       )
       UNION ALL
       (
         SELECT 'show', id, title, posterpath, releaseyear FROM show s
         WHERE NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'show' AND p.media_id = s.id
         )
         ORDER BY id
         LIMIT 20
       )
       UNION ALL
       (
         SELECT 'book', id, title, NULL, releaseyear FROM book b
         WHERE NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'book' AND p.media_id = b.id
         )
         ORDER BY id
         LIMIT 20
       )`,
      [userId]
    );
    return rows.map((row) => toItem(row.kind, row.id, row.title, row.posterpath, "vault", yearDetail(row.releaseyear))).filter((item) => item !== void 0);
  } catch {
    return [];
  }
}
function toItem(kind, id, title, poster, reason, detail) {
  if (kind !== "movie" && kind !== "documentary" && kind !== "show" && kind !== "book") {
    return void 0;
  }
  const mediaId = Number(id);
  const name = String(title ?? "").trim();
  if (!Number.isInteger(mediaId) || mediaId < 1 || !name) {
    return void 0;
  }
  const posterPath = parsePosterPath(poster);
  return {
    id: `${kind}:${mediaId}`,
    title: name,
    kind,
    reason,
    ...detail ? { detail } : {},
    ...posterPath ? { posterPath } : {}
  };
}
function episodeDetail(season, episode, title) {
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const name = String(title ?? "").trim();
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return name || void 0;
  }
  const seasonLabel = seasonNumber === 0 ? "Specials" : `S${seasonNumber}`;
  const prefix = `${seasonLabel} E${episodeNumber}`;
  return name ? `${prefix} \xB7 ${name}` : prefix;
}
function joinDetail(seriesTitle, year) {
  return [String(seriesTitle ?? "").trim(), yearDetail(year)].filter(Boolean).join(" \xB7 ") || void 0;
}
function yearDetail(year) {
  const value = Number(year);
  return Number.isInteger(value) && value > 0 ? String(value) : void 0;
}
function shuffleWithSeed(items, seed) {
  const next = [...items];
  let value = seed >>> 0 || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    value = Math.imul(value, 1664525) + 1013904223 >>> 0;
    const swap = value % (index + 1);
    const current = next[index];
    const other = next[swap];
    if (current === void 0 || other === void 0) {
      continue;
    }
    next[index] = other;
    next[swap] = current;
  }
  return next;
}

// api-src/progress.ts
var runtime = "nodejs";
var maxDuration = 30;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json(await loadProgress(connectionString, user));
  } catch (error) {
    return jsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}
async function PATCH(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = await request.json().catch(() => ({}));
    const { kind, mediaId } = parseCatalogId(body.id, LIBRARY_MEDIA_KINDS);
    const dated = body.dated !== false;
    const year = dated ? parseWatchYear(body.year) : void 0;
    if (body.completed) {
      await upsertProgress(connectionString, user.id, kind, mediaId, dated, year);
    } else {
      await execute(
        connectionString,
        "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = $2 AND media_id = $3",
        [user.id, kind, mediaId]
      );
    }
    if (kind === "series") {
      await cascadeSeriesMovies(connectionString, user.id, mediaId, Boolean(body.completed), dated, year);
    } else if (kind === "movie") {
      await syncSeriesForMovie(connectionString, user.id, mediaId, dated, year);
    }
    return Response.json(await loadProgress(connectionString, user));
  } catch (error) {
    return jsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}
async function upsertProgress(connectionString, userId, kind, mediaId, dated, year) {
  if (!dated) {
    await execute(
      connectionString,
      `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (user_id, media_kind, media_id)
       DO UPDATE SET completed_at = EXCLUDED.completed_at`,
      [userId, kind, mediaId]
    );
    return;
  }
  if (year) {
    await execute(
      connectionString,
      `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       ON CONFLICT (user_id, media_kind, media_id)
       DO UPDATE SET completed_at = EXCLUDED.completed_at`,
      [userId, kind, mediaId, watchTimestamp(year)]
    );
    return;
  }
  await execute(
    connectionString,
    `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, media_kind, media_id)
     DO UPDATE SET completed_at = EXCLUDED.completed_at`,
    [userId, kind, mediaId]
  );
}
async function cascadeSeriesMovies(connectionString, userId, seriesId, completed, dated, year) {
  try {
    if (completed) {
      const movies = await queryRows(connectionString, "SELECT id FROM movie WHERE seriesid = $1", [seriesId]);
      for (const row of movies) {
        const movieId = asId(row);
        if (movieId) {
          await upsertProgress(connectionString, userId, "movie", movieId, dated, year);
        }
      }
      return;
    }
    await execute(
      connectionString,
      `DELETE FROM user_media_progress
       WHERE user_id = $1
         AND media_kind = 'movie'
         AND media_id IN (SELECT id FROM movie WHERE seriesid = $2)`,
      [userId, seriesId]
    );
  } catch {
  }
}
async function syncSeriesForMovie(connectionString, userId, movieId, dated, year) {
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
      [userId, seriesId]
    );
    const total = Number(rows[0]?.total) || 0;
    const finished = Number(rows[0]?.finished) || 0;
    if (total > 0 && finished >= total) {
      await upsertProgress(connectionString, userId, "series", seriesId, dated, year);
      return;
    }
    await execute(
      connectionString,
      "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = 'series' AND media_id = $2",
      [userId, seriesId]
    );
  } catch {
  }
}
async function loadProgress(connectionString, user) {
  await seedAdminProgressIfNeeded(connectionString, user);
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id, completed_at FROM user_media_progress WHERE user_id = $1",
    [user.id]
  );
  const recent = await queryRows(
    connectionString,
    `SELECT media_kind, media_id FROM user_media_progress
     WHERE user_id = $1 AND completed_at IS NOT NULL
     ORDER BY completed_at DESC, media_kind, media_id
     LIMIT 8`,
    [user.id]
  );
  const watchedYears = {};
  for (const row of rows) {
    const year = yearFromCompletedAt(row.completed_at);
    if (year) {
      watchedYears[progressId(row)] = year;
    }
  }
  const recentIds = recent.map(progressId);
  const watchNext = await loadWatchNext(connectionString, user.id).catch(() => []);
  const homePosters = await postersForCatalogIds(connectionString, [
    ...recentIds,
    ...watchNext.map((item) => item.id)
  ]);
  return {
    ids: rows.map(progressId),
    recentIds,
    undatedIds: rows.filter((row) => row.completed_at == null).map(progressId),
    watchedYears,
    recentPosters: Object.fromEntries(recentIds.flatMap((id) => homePosters[id] ? [[id, homePosters[id]]] : [])),
    watchNext: watchNext.map((item) => {
      const posterPath = item.posterPath ?? homePosters[item.id];
      return posterPath && !item.posterPath ? { ...item, posterPath } : item;
    })
  };
}
function progressId(row) {
  return `${String(row.media_kind)}:${Number(row.media_id)}`;
}
async function seedAdminProgressIfNeeded(connectionString, user) {
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
    "SELECT $1, 'book', id FROM book WHERE read"
  ];
  for (const selectSql of copies) {
    try {
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id)
         ${selectSql}
         ON CONFLICT DO NOTHING`,
        [user.id]
      );
    } catch {
    }
  }
  await execute(
    connectionString,
    "INSERT INTO user_progress_seed (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    [user.id]
  );
}
async function requireUser(request, connectionString) {
  await ensureUserLibrarySchema(connectionString);
  return requireSessionUser(request, connectionString);
}
export {
  GET,
  PATCH,
  maxDuration,
  runtime
};
