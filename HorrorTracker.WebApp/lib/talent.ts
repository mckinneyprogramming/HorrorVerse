import type { TalentCredit, TalentFollow, TalentName, TalentPerson } from "./talent-model";
import { execute, HttpError, queryRows } from "./neon";
import { parsePosterPath } from "./poster";
import { asId, asPositiveInt, tmdbJsonOptional, yearFrom } from "./tmdb";

export type { TalentCredit, TalentFollow, TalentName, TalentPerson };

const HORROR_GENRE = 27;
const DOCUMENTARY_GENRE = 99;
const CAST_LIMIT = 8;
const DIRECTOR_LIMIT = 4;
const FILMOGRAPHY_LIMIT = 120;

interface StoredCredit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  kind: "movie" | "documentary" | "show";
  title: string;
  year?: number;
  posterPath?: string;
  role: string;
}

export function selectTitleCredits(payload: Record<string, unknown>): { directors: TalentName[]; cast: TalentName[] } {
  const directors: TalentName[] = [];
  const seenDirectors = new Set<number>();
  for (const item of records(payload.crew)) {
    if (directors.length >= DIRECTOR_LIMIT) {
      break;
    }

    if (String(item.job ?? "").trim().toLowerCase() !== "director") {
      continue;
    }

    const person = readName(item, "Director");
    if (!person || seenDirectors.has(person.id)) {
      continue;
    }

    seenDirectors.add(person.id);
    directors.push(person);
  }

  const cast: TalentName[] = [];
  const seenCast = new Set<number>();
  const ranked = records(payload.cast)
    .map((item, index) => ({ item, index, order: billingOrder(item) }))
    .sort((left, right) => left.order - right.order || left.index - right.index);
  for (const { item } of ranked) {
    if (cast.length >= CAST_LIMIT) {
      break;
    }

    const character = clip(item.character, 80);
    const person = readName(item, character || "Cast");
    if (!person || seenCast.has(person.id)) {
      continue;
    }

    seenCast.add(person.id);
    cast.push(person);
  }

  return { directors, cast };
}

export function selectFilmography(payload: Record<string, unknown>): {
  name: string;
  profilePath?: string;
  knownFor?: string;
  credits: StoredCredit[];
} {
  const combined = record(payload.combined_credits) ?? {};
  const credits = new Map<string, StoredCredit>();
  for (const item of records(combined.cast)) {
    rememberCredit(credits, item, clip(item.character, 80) || "Cast");
  }

  for (const item of records(combined.crew)) {
    if (String(item.job ?? "").trim().toLowerCase() !== "director") {
      continue;
    }

    rememberCredit(credits, item, "Director");
  }

  const knownFor = clip(payload.known_for_department, 40);
  const profilePath = parsePosterPath(payload.profile_path);
  return {
    name: clip(payload.name, 200) ?? "",
    ...(profilePath ? { profilePath } : {}),
    ...(knownFor ? { knownFor } : {}),
    credits: [...credits.values()]
      .map((credit) => ({ credit, year: credit.year ?? 0 }))
      .sort((left, right) => right.year - left.year || left.credit.title.localeCompare(right.credit.title))
      .map((item) => item.credit)
      .slice(0, FILMOGRAPHY_LIMIT),
  };
}

export async function titleCredits(
  connectionString: string,
  titleId: string,
): Promise<{ directors: TalentName[]; cast: TalentName[] }> {
  await ensureTalentSchema(connectionString);
  const parsed = parseVaultTitle(titleId);
  if (!parsed) {
    return { directors: [], cast: [] };
  }

  const tmdbId = await lookupTmdbId(connectionString, parsed.kind, parsed.mediaId);
  if (!tmdbId) {
    return { directors: [], cast: [] };
  }

  const path = parsed.kind === "show" ? `/tv/${tmdbId}/credits` : `/movie/${tmdbId}/credits`;
  const payload = await tmdbJsonOptional(path);
  return selectTitleCredits(payload ?? {});
}

export async function openTalent(connectionString: string, userId: number, personId: number): Promise<TalentPerson> {
  const person = await loadPerson(connectionString, userId, personId);
  if (!person) {
    throw new HttpError("That person was not found.", 404);
  }

  return person;
}

export async function listFollowedTalent(connectionString: string, userId: number): Promise<TalentFollow[]> {
  await ensureTalentSchema(connectionString);
  const follows = await queryRows(
    connectionString,
    `SELECT person_id, name, profile_path, known_for
     FROM user_talent_follow
     WHERE user_id = $1
     ORDER BY created_at DESC, person_id`,
    [userId],
  );
  const people: TalentFollow[] = [];
  for (const row of follows) {
    const id = asId(row, "person_id");
    const name = clip(row.name, 200);
    if (!id || !name) {
      continue;
    }

    const profilePath = parsePosterPath(row.profile_path);
    const knownFor = clip(row.known_for, 40);
    const stored = await readCachedCredits(connectionString, id);
    const filled =
      stored.length > 0
        ? await annotateCredits(connectionString, userId, stored)
        : ((await loadPerson(connectionString, userId, id))?.credits ?? []);
    const watched = filled.filter((credit) => credit.finished).length;
    people.push({
      id,
      name,
      ...(profilePath ? { profilePath } : {}),
      ...(knownFor ? { knownFor } : {}),
      watched,
      total: filled.length,
    });
  }

  return people;
}

export async function followTalent(connectionString: string, userId: number, personId: number): Promise<TalentPerson> {
  const person = await openTalent(connectionString, userId, personId);
  await execute(
    connectionString,
    `INSERT INTO user_talent_follow (user_id, person_id, name, profile_path, known_for)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, person_id) DO UPDATE
     SET name = EXCLUDED.name, profile_path = EXCLUDED.profile_path, known_for = EXCLUDED.known_for`,
    [userId, person.id, person.name, person.profilePath ?? null, person.knownFor ?? null],
  );
  return { ...person, following: true };
}

export async function unfollowTalent(connectionString: string, userId: number, personId: number): Promise<TalentPerson> {
  requirePersonId(personId);
  await ensureTalentSchema(connectionString);
  await execute(connectionString, "DELETE FROM user_talent_follow WHERE user_id = $1 AND person_id = $2", [userId, personId]);
  try {
    const person = await openTalent(connectionString, userId, personId);
    return { ...person, following: false };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { id: personId, name: "Unknown", following: false, watched: 0, total: 0, credits: [] };
    }

    throw error;
  }
}

async function loadPerson(connectionString: string, userId: number, personId: number): Promise<TalentPerson | undefined> {
  requirePersonId(personId);
  await ensureTalentSchema(connectionString);
  const payload = await tmdbJsonOptional(`/person/${personId}?append_to_response=combined_credits`);
  if (!payload) {
    return undefined;
  }

  const selected = selectFilmography(payload);
  if (!selected.name) {
    return undefined;
  }

  await replaceCredits(connectionString, personId, selected.credits);
  const [annotated, following] = await Promise.all([
    annotateCredits(connectionString, userId, selected.credits),
    isFollowing(connectionString, userId, personId),
  ]);
  return {
    id: personId,
    name: selected.name,
    ...(selected.profilePath ? { profilePath: selected.profilePath } : {}),
    ...(selected.knownFor ? { knownFor: selected.knownFor } : {}),
    following,
    watched: annotated.filter((credit) => credit.finished).length,
    total: annotated.length,
    credits: annotated,
  };
}

async function readCachedCredits(connectionString: string, personId: number): Promise<StoredCredit[]> {
  const rows = await queryRows(
    connectionString,
    `SELECT media_type, tmdb_id, title, release_year, poster_path, role, kind
     FROM talent_filmography
     WHERE person_id = $1`,
    [personId],
  );
  const credits: StoredCredit[] = [];
  for (const row of rows) {
    const credit = readStoredCredit(row);
    if (credit) {
      credits.push(credit);
    }
  }

  return credits;
}

async function annotateCredits(connectionString: string, userId: number, credits: StoredCredit[]): Promise<TalentCredit[]> {
  const vault = await vaultByTmdb(connectionString);
  const finished = await finishedIds(connectionString, userId);
  return credits.map((credit) => {
    const vaultId = vault.get(`${credit.kind}:${credit.tmdbId}`);
    return {
      ...credit,
      ...(vaultId ? { vaultId } : {}),
      finished: Boolean(vaultId && finished.has(vaultId)),
    };
  });
}

async function vaultByTmdb(connectionString: string): Promise<Map<string, string>> {
  const rows = await queryRows(
    connectionString,
    `SELECT 'movie' AS kind, id, tmdbid FROM movie WHERE tmdbid IS NOT NULL
     UNION ALL
     SELECT 'documentary', id, tmdbid FROM documentary WHERE tmdbid IS NOT NULL
     UNION ALL
     SELECT 'show', id, tmdbid FROM show WHERE tmdbid IS NOT NULL`,
  );
  const vault = new Map<string, string>();
  for (const row of rows) {
    const kind = String(row.kind ?? "");
    const id = asId(row);
    const tmdbId = asId(row, "tmdbid");
    if ((kind === "movie" || kind === "documentary" || kind === "show") && id && tmdbId) {
      vault.set(`${kind}:${tmdbId}`, `${kind}:${id}`);
    }
  }

  return vault;
}

async function finishedIds(connectionString: string, userId: number): Promise<Set<string>> {
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id FROM user_media_progress WHERE user_id = $1 AND completed_at IS NOT NULL",
    [userId],
  );
  const ids = new Set<string>();
  for (const row of rows) {
    const kind = String(row.media_kind ?? "");
    const id = asId(row, "media_id");
    if (kind && id) {
      ids.add(`${kind}:${id}`);
    }
  }

  return ids;
}

async function isFollowing(connectionString: string, userId: number, personId: number): Promise<boolean> {
  const rows = await queryRows(
    connectionString,
    "SELECT 1 FROM user_talent_follow WHERE user_id = $1 AND person_id = $2",
    [userId, personId],
  );
  return rows.length > 0;
}

async function lookupTmdbId(connectionString: string, kind: "movie" | "documentary" | "show", mediaId: number): Promise<number | undefined> {
  const table = kind === "movie" ? "movie" : kind === "documentary" ? "documentary" : "show";
  const rows = await queryRows(connectionString, `SELECT tmdbid FROM ${table} WHERE id = $1`, [mediaId]);
  return asId(rows[0], "tmdbid");
}

async function replaceCredits(connectionString: string, personId: number, credits: StoredCredit[]): Promise<void> {
  await execute(connectionString, "DELETE FROM talent_filmography WHERE person_id = $1", [personId]);
  if (credits.length < 1) {
    return;
  }

  const values: string[] = [];
  const params: unknown[] = [];
  credits.forEach((credit, index) => {
    const base = index * 8;
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, NOW())`,
    );
    params.push(
      personId,
      credit.mediaType,
      credit.tmdbId,
      credit.title,
      credit.year ?? null,
      credit.posterPath ?? null,
      credit.role,
      credit.kind,
    );
  });
  await execute(
    connectionString,
    `INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, release_year, poster_path, role, kind, refreshed_at)
     VALUES ${values.join(", ")}`,
    params,
  );
}

let talentSchema: Promise<void> | undefined;
let talentSchemaKey = "";

export function resetTalentSchema(): void {
  talentSchema = undefined;
  talentSchemaKey = "";
}

async function ensureTalentSchema(connectionString: string): Promise<void> {
  if (talentSchema && talentSchemaKey === connectionString) {
    return talentSchema;
  }

  talentSchemaKey = connectionString;
  talentSchema = createTalentSchema(connectionString).catch((error: unknown) => {
    talentSchema = undefined;
    talentSchemaKey = "";
    throw error;
  });
  return talentSchema;
}

async function createTalentSchema(connectionString: string): Promise<void> {
  await execute(connectionString, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS user_talent_follow (
        user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        profile_path TEXT,
        known_for TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, person_id)
      )`,
  );
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS talent_filmography (
        person_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        release_year INTEGER,
        poster_path TEXT,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (person_id, media_type, tmdb_id)
      )`,
  );
}

function rememberCredit(credits: Map<string, StoredCredit>, item: Record<string, unknown>, role: string): void {
  const mediaType = item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : undefined;
  const tmdbId = asPositiveInt(item.id);
  const title = clip(item.title ?? item.name, 200);
  if (!mediaType || !tmdbId || !title || !hasGenre(item, HORROR_GENRE)) {
    return;
  }

  const key = `${mediaType}:${tmdbId}`;
  const existing = credits.get(key);
  const posterPath = parsePosterPath(item.poster_path);
  const year = yearFrom(item.release_date ?? item.first_air_date);
  const kind = mediaType === "tv" ? "show" : hasGenre(item, DOCUMENTARY_GENRE) ? "documentary" : "movie";
  if (!existing) {
    credits.set(key, {
      tmdbId,
      mediaType,
      kind,
      title,
      ...(year ? { year } : {}),
      ...(posterPath ? { posterPath } : {}),
      role,
    });
    return;
  }

  existing.role = mergeRole(existing.role, role);
  if (!existing.posterPath && posterPath) {
    existing.posterPath = posterPath;
  }

  if (!existing.year && year) {
    existing.year = year;
  }
}

function readStoredCredit(row: Record<string, unknown>): StoredCredit | undefined {
  const mediaType = row.media_type === "tv" ? "tv" : row.media_type === "movie" ? "movie" : undefined;
  const tmdbId = asId(row, "tmdb_id");
  const title = clip(row.title, 200);
  const kind = row.kind === "show" || row.kind === "documentary" || row.kind === "movie" ? row.kind : undefined;
  const role = clip(row.role, 120);
  if (!mediaType || !tmdbId || !title || !kind || !role) {
    return undefined;
  }

  const year = asPositiveInt(row.release_year);
  const posterPath = parsePosterPath(row.poster_path);
  return {
    tmdbId,
    mediaType,
    kind,
    title,
    ...(year ? { year } : {}),
    ...(posterPath ? { posterPath } : {}),
    role,
  };
}

function readName(item: Record<string, unknown>, role: string): TalentName | undefined {
  const id = asPositiveInt(item.id);
  const name = clip(item.name, 200);
  if (!id || !name) {
    return undefined;
  }

  const profilePath = parsePosterPath(item.profile_path);
  return { id, name, role, ...(profilePath ? { profilePath } : {}) };
}

function mergeRole(current: string, next: string): string {
  if (current === next || current.split(" · ").includes(next)) {
    return current;
  }

  if (current === "Cast") {
    return next;
  }

  if (next === "Cast") {
    return current;
  }

  return `${current} · ${next}`;
}

function billingOrder(item: Record<string, unknown>): number {
  const order = Number(item.order);
  return Number.isInteger(order) && order >= 0 ? order : 10000;
}

function hasGenre(item: Record<string, unknown>, genreId: number): boolean {
  return Array.isArray(item.genre_ids) && item.genre_ids.some((id) => Number(id) === genreId);
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function clip(value: unknown, max: number): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }

  return text.length <= max ? text : text.slice(0, max).trimEnd();
}

function parseVaultTitle(titleId: string): { kind: "movie" | "documentary" | "show"; mediaId: number } | undefined {
  const match = /^(movie|documentary|show):(\d+)$/.exec(titleId);
  const mediaId = Number(match?.[2]);
  if (!match || !Number.isInteger(mediaId) || mediaId < 1) {
    return undefined;
  }

  return { kind: match[1] as "movie" | "documentary" | "show", mediaId };
}

function requirePersonId(personId: number): void {
  if (!Number.isInteger(personId) || personId < 1) {
    throw new HttpError("Choose a person to open.", 400);
  }
}
