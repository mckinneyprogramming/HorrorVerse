import { HttpError } from "./neon";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function tmdbJson(path: string): Promise<Record<string, unknown>> {
  const payload = await tmdbJsonOptional(path);
  if (!payload) {
    throw new HttpError("Could not reach TMDb.", 502);
  }

  return payload;
}

export async function tmdbJsonOptional(path: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.TMDBKey?.trim();
  if (!apiKey) {
    throw new HttpError("TMDBKey is not configured.", 503);
  }

  try {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`);
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
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

export function asResults(payload: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(payload.results) ? payload.results.filter((item) => item && typeof item === "object") : [];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function asId(row: Record<string, unknown> | undefined, key = "id"): number | undefined {
  return asPositiveInt(row?.[key]);
}

export function asPositiveInt(value: unknown): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function yearFrom(value: unknown): number | undefined {
  const text = String(value ?? "");
  const year = Number(text.slice(0, 4));
  return Number.isInteger(year) && year >= 1888 && year <= 3000 ? year : undefined;
}

export function runtimeOf(value: unknown): number {
  const runtime = Number(value);
  return Number.isFinite(runtime) && runtime > 0 ? runtime : 0;
}

export function showTotalMinutes(show: Record<string, unknown>, fallbackEpisodeMinutes = 0): number {
  const episodes = Math.max(Number(show.number_of_episodes) || 0, 0);
  const episodeMinutes = episodeLengthMinutes(show) || fallbackEpisodeMinutes;
  return episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
}

export function episodeLengthMinutes(show: Record<string, unknown>): number {
  const listed = Array.isArray(show.episode_run_time)
    ? show.episode_run_time.map(Number).find((value) => Number.isFinite(value) && value > 0)
    : undefined;
  if (listed && listed > 0) {
    return listed;
  }

  return runtimeOf(asRecord(show.last_episode_to_air)?.runtime) || runtimeOf(asRecord(show.next_episode_to_air)?.runtime);
}

export function seriesTitle(name: string): string {
  const trimmed = name.replace(/\s+Collection$/i, "").trim();
  return trimmed.length > 0 ? trimmed : name.trim();
}

export function requireTitle(value: unknown): string {
  const title = String(value ?? "").trim();
  if (title.length < 1 || title.length > 200) {
    throw new HttpError("TMDb did not return a usable title.", 400);
  }

  return title;
}

export const HORROR_ADJACENT_GENRES = new Set([27, 53, 9648, 878, 14, 10765]);
export const DOCUMENTARY_GENRE = 99;

export function isHorrorAdjacent(value: unknown): boolean {
  return Array.isArray(value) && value.some((id) => HORROR_ADJACENT_GENRES.has(Number(id)));
}

export function isDocumentary(value: unknown): boolean {
  return Array.isArray(value) && value.some((id) => Number(id) === DOCUMENTARY_GENRE);
}

export async function collectionIsHorrorAdjacent(collectionId: number): Promise<boolean> {
  try {
    const collection = await tmdbJson(`/collection/${collectionId}`);
    const parts = Array.isArray(collection.parts) ? collection.parts : [];
    return parts.some((part) => isHorrorAdjacent(asRecord(part)?.genre_ids));
  } catch {
    return false;
  }
}

export function trimOverview(value: unknown): string | undefined {
  const overview = String(value ?? "").trim();
  if (!overview) {
    return undefined;
  }

  return overview.length <= 180 ? overview : `${overview.slice(0, 177).trimEnd()}…`;
}
