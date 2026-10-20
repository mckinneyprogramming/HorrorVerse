import { execute, HttpError, queryRows } from "./neon";
import { asId } from "./tmdb";

const MAX_RESULTS = 8;
const SEARCH_POOL = 20;
const HORROR_NAME = /horror|survival horror/i;
const TOKEN_SKEW_MS = 60_000;

export interface IgdbHit {
  sourceId: string;
  title: string;
  year?: number;
  overview?: string;
  coverUrl?: string;
}

export interface IgdbGame {
  sourceId: string;
  title: string;
  year: number;
  description?: string;
  coverUrl?: string;
  developer?: string;
  publisher?: string;
  platforms?: string;
  genres: string[];
}

let cachedToken: { value: string; expiresAt: number } | undefined;

export function parseIgdbId(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  return /^\d+$/.test(raw) && Number(raw) >= 1 ? raw : undefined;
}

export function igdbCoverUrl(imageId: unknown): string | undefined {
  const id = String(imageId ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id) || id.length > 80) {
    return undefined;
  }

  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`;
}

/** Accept current IGDB cover URLs and rewrite the pre-/upload/ form stored by an earlier build. */
export function normalizeIgdbCoverUrl(value: unknown): string | undefined {
  const url = String(value ?? "").trim();
  if (/^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_cover_big\/[A-Za-z0-9_-]+\.jpg$/.test(url)) {
    return url;
  }

  const legacy = /^https:\/\/images\.igdb\.com\/igdb\/image\/t_cover_big\/([A-Za-z0-9_-]+)\.jpg$/.exec(url);
  return legacy ? igdbCoverUrl(legacy[1]) : undefined;
}

export function parseIgdbSearch(payload: unknown): IgdbHit[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const hits: { horror: boolean; index: number; hit: IgdbHit }[] = [];
  payload.forEach((row, index) => {
    const record = asRecord(row);
    const sourceId = parseIgdbId(record?.id);
    const title = cleanText(record?.name, 200);
    if (!sourceId || !title) {
      return;
    }

    const genres = namedList(record?.genres);
    const themes = namedList(record?.themes);
    const platforms = namedList(record?.platforms).slice(0, 3);
    const overview = [genres.slice(0, 2).join(", "), platforms.join(", ")].filter(Boolean).join(" · ");
    const year = yearFromUnix(record?.first_release_date);
    const cover = asRecord(record?.cover);
    const coverUrl = igdbCoverUrl(cover?.image_id);
    hits.push({
      horror: [...genres, ...themes].some((name) => HORROR_NAME.test(name)),
      index,
      hit: {
        sourceId,
        title,
        ...(year ? { year } : {}),
        ...(overview ? { overview } : {}),
        ...(coverUrl ? { coverUrl } : {}),
      },
    });
  });

  return hits
    .sort((left, right) => Number(right.horror) - Number(left.horror) || left.index - right.index)
    .slice(0, MAX_RESULTS)
    .map((item) => item.hit);
}

export function parseIgdbGame(payload: unknown): IgdbGame | undefined {
  const record = Array.isArray(payload) ? asRecord(payload[0]) : asRecord(payload);
  const sourceId = parseIgdbId(record?.id);
  const title = cleanText(record?.name, 200);
  if (!sourceId || !title) {
    return undefined;
  }

  const companies = Array.isArray(record?.involved_companies) ? record.involved_companies : [];
  const developers: string[] = [];
  const publishers: string[] = [];
  for (const company of companies) {
    const row = asRecord(company);
    const name = cleanText(asRecord(row?.company)?.name, 120);
    if (!name) {
      continue;
    }

    if (row?.developer) {
      developers.push(name);
    }

    if (row?.publisher) {
      publishers.push(name);
    }
  }

  const genres = uniqueNames([...namedList(record?.genres), ...namedList(record?.themes)]).slice(0, 12);
  const platforms = namedList(record?.platforms).slice(0, 8).join(", ");
  const coverUrl = igdbCoverUrl(asRecord(record?.cover)?.image_id);
  const description = cleanText(record?.summary, 4000);
  return {
    sourceId,
    title,
    year: yearFromUnix(record?.first_release_date) ?? 0,
    genres,
    ...(description ? { description } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(developers[0] ? { developer: developers.slice(0, 3).join(", ").slice(0, 180) } : {}),
    ...(publishers[0] ? { publisher: publishers.slice(0, 3).join(", ").slice(0, 180) } : {}),
    ...(platforms ? { platforms: platforms.slice(0, 200) } : {}),
  };
}

export async function searchIgdb(query: string): Promise<IgdbHit[]> {
  const text = escapeIgdbString(query.trim());
  const payload = await igdbPost(
    "games",
    `search "${text}"; fields name,summary,first_release_date,cover.image_id,genres.name,themes.name,platforms.name; limit ${SEARCH_POOL};`,
  );
  return parseIgdbSearch(payload);
}

export async function importIgdbGame(connectionString: string, sourceId: string): Promise<{ added: number; id: string }> {
  const id = parseIgdbId(sourceId);
  if (!id) {
    throw new HttpError("Choose an IGDB game to add.", 400);
  }

  await ensureGameColumns(connectionString);
  const payload = await igdbPost(
    "games",
    `where id = ${id}; fields name,summary,first_release_date,cover.image_id,genres.name,themes.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`,
  );
  const game = parseIgdbGame(payload);
  if (!game) {
    throw new HttpError("IGDB did not return that game.", 502);
  }

  const existing = await queryRows(connectionString, "SELECT id FROM game WHERE igdbid = $1 LIMIT 1", [Number(game.sourceId)]);
  const existingId = asId(existing[0]);
  const gameId = existingId ?? (await insertGame(connectionString, game));
  await updateGame(connectionString, gameId, game);
  await saveGameGenres(connectionString, gameId, game.genres);
  return { added: existingId ? 0 : 1, id: `game:${gameId}` };
}

export async function ensureGameColumns(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS game (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      releaseyear INTEGER NOT NULL,
      played BOOLEAN NOT NULL
    )`,
  );
  await execute(connectionString, "ALTER TABLE game ADD COLUMN IF NOT EXISTS igdbid INTEGER");
  await execute(connectionString, "ALTER TABLE game ADD COLUMN IF NOT EXISTS description TEXT");
  await execute(connectionString, "ALTER TABLE game ADD COLUMN IF NOT EXISTS coverurl TEXT");
  await execute(connectionString, "ALTER TABLE game ADD COLUMN IF NOT EXISTS developer TEXT");
  await execute(connectionString, "ALTER TABLE game ADD COLUMN IF NOT EXISTS publisher TEXT");
  await execute(connectionString, "ALTER TABLE game ADD COLUMN IF NOT EXISTS platforms TEXT");
}

async function insertGame(connectionString: string, game: IgdbGame): Promise<number> {
  const rows = await queryRows(
    connectionString,
    `INSERT INTO game (title, releaseyear, played, igdbid)
     VALUES ($1, $2, FALSE, $3)
     RETURNING id`,
    [game.title, game.year, Number(game.sourceId)],
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new HttpError("Could not save that game.", 500);
  }

  return id;
}

async function updateGame(connectionString: string, gameId: number, game: IgdbGame): Promise<void> {
  await execute(
    connectionString,
    `UPDATE game
     SET title = $2,
         releaseyear = CASE WHEN $3 > 0 THEN $3 ELSE releaseyear END,
         igdbid = $4,
         description = $5,
         coverurl = $6,
         developer = $7,
         publisher = $8,
         platforms = $9
     WHERE id = $1`,
    [
      gameId,
      game.title,
      game.year,
      Number(game.sourceId),
      game.description ?? null,
      game.coverUrl ?? null,
      game.developer ?? null,
      game.publisher ?? null,
      game.platforms ?? null,
    ],
  );
}

async function saveGameGenres(connectionString: string, gameId: number, genres: string[]): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS media_keyword (
      media_kind TEXT NOT NULL,
      media_id INTEGER NOT NULL,
      tmdb_keyword_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (media_kind, media_id, tmdb_keyword_id)
    )`,
  );
  await execute(connectionString, "DELETE FROM media_keyword WHERE media_kind = 'game' AND media_id = $1", [gameId]);
  for (const name of genres) {
    await execute(
      connectionString,
      `INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
       VALUES ('game', $1, $2, $3)
       ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name`,
      [gameId, subjectKey(name), name],
    );
  }
}

async function igdbPost(endpoint: string, body: string): Promise<unknown> {
  const token = await twitchToken();
  const clientId = requireIgdbClientId();
  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!response.ok) {
    throw new HttpError("Could not reach IGDB.", 502);
  }

  return response.json().catch(() => {
    throw new HttpError("Could not reach IGDB.", 502);
  });
}

async function twitchToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return cachedToken.value;
  }

  const clientId = requireIgdbClientId();
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new HttpError("IGDB_CLIENT_SECRET is not configured.", 503);
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: "POST" },
  );
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) {
    throw new HttpError("Could not authenticate with IGDB.", 502);
  }

  const expiresIn = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 3600;
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return payload.access_token;
}

function requireIgdbClientId(): string {
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  if (!clientId) {
    throw new HttpError("IGDB_CLIENT_ID is not configured.", 503);
  }

  return clientId;
}

function namedList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanText(asRecord(item)?.name, 80))
    .filter((name): name is string => Boolean(name));
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(name);
  }

  return result;
}

function yearFromUnix(value: unknown): number | undefined {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 1) {
    return undefined;
  }

  const year = new Date(seconds * 1000).getUTCFullYear();
  return year >= 1 && year <= 3000 ? year : undefined;
}

function cleanText(value: unknown, max: number): string | undefined {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return undefined;
  }

  return text.length > max ? text.slice(0, max).trim() : text;
}

function escapeIgdbString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function subjectKey(name: string): number {
  let hash = 0;
  for (const character of name.toLowerCase()) {
    hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
  }

  const key = hash % 2_000_000_000;
  return key === 0 ? 1 : key;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
