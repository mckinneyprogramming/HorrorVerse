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
function asId(row, key = "id") {
  return asPositiveInt(row?.[key]);
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

// lib/catalog.ts
async function ensureShowTmdbId(connectionString, showId) {
  const existing = asId((await queryRows(connectionString, "SELECT tmdbid FROM show WHERE id = $1", [showId]))[0], "tmdbid");
  if (existing) {
    return existing;
  }
  const row = (await queryRows(connectionString, "SELECT title, releaseyear FROM show WHERE id = $1", [showId]))[0];
  const title = String(row?.title ?? "").trim();
  if (title.length < 2) {
    return void 0;
  }
  const year = yearFrom(row?.releaseyear);
  const results = asResults(await tmdbJson(`/search/tv?query=${encodeURIComponent(title)}&include_adult=false`));
  const sameTitle = results.filter((item) => String(item.name ?? "").trim().toLowerCase() === title.toLowerCase());
  const match = (year ? sameTitle.find((item) => yearFrom(item.first_air_date) === year) : void 0) ?? sameTitle[0] ?? results[0];
  const tmdbId = Number(match?.id);
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return void 0;
  }
  await execute(connectionString, "UPDATE show SET tmdbid = $1 WHERE id = $2", [tmdbId, showId]);
  return tmdbId;
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

// api-src/shows.ts
var runtime = "nodejs";
var maxDuration = 60;
async function GET(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const userId = (await requireSessionUser(request, connectionString)).id;
    const url = new URL(request.url);
    const showId = parseShowId(url.searchParams.get("id"));
    const season = parseOptionalInt(url.searchParams.get("season"));
    await ensureSchema(connectionString);
    await ensureShowExists(connectionString, showId);
    const tmdbId = await ensureShowTmdbId(connectionString, showId);
    if (tmdbId) {
      await refreshSeasons(connectionString, showId, tmdbId);
      if (season !== void 0) {
        await ensureEpisodes(connectionString, showId, tmdbId, season);
      }
    }
    return Response.json(await loadGuide(connectionString, userId, showId));
  } catch (error) {
    return jsonError(error, { log: "Show guide request failed.", fallback: "Could not load that show." });
  }
}
async function PATCH(request) {
  try {
    const connectionString = requireDatabaseUrl();
    const userId = (await requireSessionUser(request, connectionString)).id;
    await ensureSchema(connectionString);
    const body = await request.json().catch(() => ({}));
    const completed = Boolean(body.completed);
    let showId;
    if (Number.isInteger(body.episodeId) && (body.episodeId ?? 0) > 0) {
      showId = await getEpisodeShowId(connectionString, Number(body.episodeId));
      await setEpisodeCompleted(connectionString, userId, Number(body.episodeId), completed);
    } else if (Number.isInteger(body.seasonId) && (body.seasonId ?? 0) > 0) {
      const season = await getSeasonRef(connectionString, Number(body.seasonId));
      showId = season.showId;
      const tmdbId = await ensureShowTmdbId(connectionString, showId);
      if (tmdbId) {
        await refreshSeasons(connectionString, showId, tmdbId);
        await ensureEpisodes(connectionString, showId, tmdbId, season.seasonNumber);
      }
      await setSeasonCompleted(connectionString, userId, Number(body.seasonId), completed);
    } else if (body.id) {
      showId = parseShowId(body.id);
      await setShowCompleted(connectionString, userId, showId, completed);
    } else {
      throw new ShowError("Choose a show, season, or episode to mark.", 400);
    }
    await syncShowProgress(connectionString, userId, showId);
    return Response.json(await loadGuide(connectionString, userId, showId));
  } catch (error) {
    return jsonError(error, { log: "Show guide request failed.", fallback: "Could not load that show." });
  }
}
async function loadGuide(connectionString, userId, showId) {
  const completed = new Set(
    (await queryRows(
      connectionString,
      `SELECT p.episode_id AS id
       FROM user_episode_progress p
       JOIN show_episode e ON e.id = p.episode_id
       WHERE p.user_id = $1 AND e.show_id = $2`,
      [userId, showId]
    )).map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0)
  );
  const seasonRows = await queryRows(
    connectionString,
    `SELECT s.id, s.season_number, s.title,
            (SELECT COUNT(*)::int FROM show_episode e WHERE e.season_id = s.id) AS episode_count
     FROM show_season s
     WHERE s.show_id = $1
     ORDER BY s.season_number`,
    [showId]
  );
  const seasons = [];
  for (const row of seasonRows) {
    const seasonId = Number(row.id);
    const episodes = await loadEpisodes(connectionString, seasonId, completed);
    const episodeCount = Number(row.episode_count) || episodes.length;
    seasons.push({
      id: seasonId,
      seasonNumber: Number(row.season_number),
      title: String(row.title ?? ""),
      episodeCount,
      finishedCount: episodes.filter((episode) => episode.completed).length,
      loaded: episodes.length > 0,
      episodes
    });
  }
  return { id: `show:${showId}`, showId, seasons };
}
async function loadEpisodes(connectionString, seasonId, completed) {
  const rows = await queryRows(
    connectionString,
    `SELECT id, episode_number, title, runtime, air_date
     FROM show_episode
     WHERE season_id = $1
     ORDER BY episode_number`,
    [seasonId]
  );
  return rows.map((row) => {
    const id = Number(row.id);
    const year = yearFrom(row.air_date);
    return {
      id,
      episodeNumber: Number(row.episode_number),
      title: String(row.title ?? ""),
      runtime: Number(row.runtime) || 0,
      ...year ? { year } : {},
      completed: completed.has(id)
    };
  });
}
async function ensureSchema(connectionString) {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS show (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      totaltime DECIMAL(10, 2) NOT NULL,
      totalepisodes INTEGER NOT NULL,
      numberofseasons INTEGER NOT NULL,
      watched BOOLEAN NOT NULL
    )`
  );
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS show_season (
      id SERIAL PRIMARY KEY,
      show_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      UNIQUE (show_id, season_number)
    )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS show_episode (
      id SERIAL PRIMARY KEY,
      show_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      runtime DECIMAL(10, 2) NOT NULL DEFAULT 0,
      air_date DATE,
      UNIQUE (season_id, episode_number)
    )`
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_episode_progress (
      user_id INTEGER NOT NULL,
      episode_id INTEGER NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, episode_id)
    )`
  );
}
async function ensureShowExists(connectionString, showId) {
  const rows = await queryRows(connectionString, "SELECT id FROM show WHERE id = $1", [showId]);
  if (!rows[0]) {
    throw new ShowError("That show was not found.", 400);
  }
}
async function refreshSeasons(connectionString, showId, tmdbId) {
  const before = new Set(
    (await queryRows(connectionString, "SELECT season_number FROM show_season WHERE show_id = $1", [showId])).map(
      (row) => Number(row.season_number)
    )
  );
  const show = await tmdbJson(`/tv/${tmdbId}`);
  const seasons = Array.isArray(show.seasons) ? show.seasons : [];
  for (const season of seasons) {
    const record = season && typeof season === "object" ? season : void 0;
    if (!record) {
      continue;
    }
    const number = Number(record.season_number);
    if (!Number.isInteger(number) || number < 0) {
      continue;
    }
    const title = String(record.name ?? "").trim() || (number === 0 ? "Specials" : `Season ${number}`);
    await execute(
      connectionString,
      `INSERT INTO show_season (show_id, season_number, title)
       VALUES ($1, $2, $3)
       ON CONFLICT (show_id, season_number) DO UPDATE SET title = EXCLUDED.title`,
      [showId, number, title]
    );
  }
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const seasonCount = Math.max(Number(show.number_of_seasons) || 0, 0);
  const runtimes = Array.isArray(show.episode_run_time) ? show.episode_run_time.map(Number) : [];
  const episodeMinutes = runtimes.find((value) => value > 0) ?? 0;
  const totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
  await execute(
    connectionString,
    "UPDATE show SET totalepisodes = $1, numberofseasons = $2, totaltime = $3, releaseyear = COALESCE(NULLIF($5, 0), releaseyear) WHERE id = $4",
    [episodes, seasonCount, totalTime, showId, yearFrom(show.first_air_date) ?? 0]
  );
  const after = (await queryRows(connectionString, "SELECT season_number FROM show_season WHERE show_id = $1", [showId])).map(
    (row) => Number(row.season_number)
  );
  if (after.some((number) => Number.isInteger(number) && !before.has(number))) {
    await invalidateShowCompletion(connectionString, showId);
  }
}
async function ensureEpisodes(connectionString, showId, tmdbId, seasonNumber) {
  await refreshSeasons(connectionString, showId, tmdbId);
  const seasonId = asId(
    (await queryRows(connectionString, "SELECT id FROM show_season WHERE show_id = $1 AND season_number = $2", [showId, seasonNumber]))[0]
  );
  if (!seasonId) {
    return;
  }
  const before = Number((await queryRows(connectionString, "SELECT COUNT(*)::int AS count FROM show_episode WHERE season_id = $1", [seasonId]))[0]?.count);
  const season = await tmdbJson(`/tv/${tmdbId}/season/${seasonNumber}`);
  const episodes = Array.isArray(season.episodes) ? season.episodes : [];
  for (const episode of episodes) {
    const record = episode && typeof episode === "object" ? episode : void 0;
    if (!record) {
      continue;
    }
    const number = Number(record.episode_number);
    if (!Number.isInteger(number) || number < 1) {
      continue;
    }
    const title = String(record.name ?? "").trim() || `Episode ${number}`;
    const runtime2 = Number(record.runtime);
    await execute(
      connectionString,
      `INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime, air_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (season_id, episode_number) DO UPDATE
       SET title = EXCLUDED.title, runtime = EXCLUDED.runtime, air_date = EXCLUDED.air_date`,
      [showId, seasonId, number, title, Number.isFinite(runtime2) && runtime2 > 0 ? runtime2 : 0, record.air_date ?? null]
    );
  }
  const after = Number((await queryRows(connectionString, "SELECT COUNT(*)::int AS count FROM show_episode WHERE season_id = $1", [seasonId]))[0]?.count);
  if (after > before) {
    await invalidateShowCompletion(connectionString, showId);
  }
}
async function invalidateShowCompletion(connectionString, showId) {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = 'show' AND media_id = $1", [showId]);
  } catch {
  }
}
async function setShowCompleted(connectionString, userId, showId, completed) {
  await ensureShowExists(connectionString, showId);
  if (completed) {
    const tmdbId = await ensureShowTmdbId(connectionString, showId);
    if (tmdbId) {
      await refreshSeasons(connectionString, showId, tmdbId);
      const seasons = await queryRows(
        connectionString,
        "SELECT season_number FROM show_season WHERE show_id = $1 ORDER BY season_number",
        [showId]
      );
      for (const row of seasons) {
        const seasonNumber = Number(row.season_number);
        if (Number.isInteger(seasonNumber)) {
          await ensureEpisodes(connectionString, showId, tmdbId, seasonNumber);
        }
      }
    }
  }
  if (completed) {
    await execute(
      connectionString,
      `INSERT INTO user_episode_progress (user_id, episode_id, completed_at)
       SELECT $1, id, NOW()
       FROM show_episode
       WHERE show_id = $2
       ON CONFLICT (user_id, episode_id) DO NOTHING`,
      [userId, showId]
    );
    return;
  }
  await execute(
    connectionString,
    `DELETE FROM user_episode_progress
     WHERE user_id = $1
       AND episode_id IN (SELECT id FROM show_episode WHERE show_id = $2)`,
    [userId, showId]
  );
}
async function setEpisodeCompleted(connectionString, userId, episodeId, completed) {
  if (completed) {
    await execute(
      connectionString,
      `INSERT INTO user_episode_progress (user_id, episode_id, completed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, episode_id) DO NOTHING`,
      [userId, episodeId]
    );
    return;
  }
  await execute(connectionString, "DELETE FROM user_episode_progress WHERE user_id = $1 AND episode_id = $2", [userId, episodeId]);
}
async function setSeasonCompleted(connectionString, userId, seasonId, completed) {
  if (completed) {
    await execute(
      connectionString,
      `INSERT INTO user_episode_progress (user_id, episode_id, completed_at)
       SELECT $1, id, NOW()
       FROM show_episode
       WHERE season_id = $2
       ON CONFLICT (user_id, episode_id) DO NOTHING`,
      [userId, seasonId]
    );
    return;
  }
  await execute(
    connectionString,
    `DELETE FROM user_episode_progress
     WHERE user_id = $1
       AND episode_id IN (SELECT id FROM show_episode WHERE season_id = $2)`,
    [userId, seasonId]
  );
}
async function syncShowProgress(connectionString, userId, showId) {
  const rows = await queryRows(
    connectionString,
    `SELECT
       (SELECT COUNT(*)::int FROM show_episode WHERE show_id = $2) AS total,
       (SELECT COUNT(*)::int FROM show_season s
        WHERE s.show_id = $2
          AND NOT EXISTS (SELECT 1 FROM show_episode e WHERE e.season_id = s.id)) AS missing,
       (SELECT COUNT(*)::int FROM user_episode_progress p
        JOIN show_episode e ON e.id = p.episode_id
        WHERE p.user_id = $1 AND e.show_id = $2) AS finished`,
    [userId, showId]
  );
  const total = Number(rows[0]?.total) || 0;
  const missing = Number(rows[0]?.missing) || 0;
  const finished = Number(rows[0]?.finished) || 0;
  const complete = total > 0 && missing === 0 && finished >= total;
  if (complete) {
    await execute(
      connectionString,
      `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
       VALUES ($1, 'show', $2, NOW())
       ON CONFLICT (user_id, media_kind, media_id)
       DO UPDATE SET completed_at = EXCLUDED.completed_at`,
      [userId, showId]
    );
    return;
  }
  await execute(connectionString, "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = 'show' AND media_id = $2", [
    userId,
    showId
  ]);
}
async function getEpisodeShowId(connectionString, episodeId) {
  const id = asId((await queryRows(connectionString, "SELECT show_id FROM show_episode WHERE id = $1", [episodeId]))[0], "show_id");
  if (!id) {
    throw new ShowError("That episode was not found.", 400);
  }
  return id;
}
async function getSeasonRef(connectionString, seasonId) {
  const row = (await queryRows(connectionString, "SELECT show_id, season_number FROM show_season WHERE id = $1", [seasonId]))[0];
  const showId = asId(row, "show_id");
  const seasonNumber = Number(row?.season_number);
  if (!showId || !Number.isInteger(seasonNumber)) {
    throw new ShowError("That season was not found.", 400);
  }
  return { showId, seasonNumber };
}
function parseShowId(id) {
  return parseCatalogId(id, ["show"], "That show was not found.").mediaId;
}
function parseOptionalInt(value) {
  if (value === null || value === "") {
    return void 0;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : void 0;
}
var ShowError = class extends HttpError {
};
export {
  GET,
  PATCH,
  maxDuration,
  runtime
};
