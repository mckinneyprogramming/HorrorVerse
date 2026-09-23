export const runtime = "nodejs";
export const maxDuration = 60;

import { asResults, tmdbJson, tmdbJsonOptional } from "../lib/tmdb";

const HORROR_GENRE = 27;
const HORROR_KEYWORD = 3158;
const EXCLUDED_TV_GENRES = new Set([35, 10762, 10763, 10764, 10766, 10767]);
const HORROR_KEYWORD_HINTS = ["horror", "slasher", "supernatural", "ghost", "zombie", "vampire", "haunted", "demonic", "occult"];
const HORIZON_YEARS = 2;
const EPISODE_HORIZON_DAYS = 90;
const MAX_PAGES = 12;
const MAX_EPISODE_PAGES = 3;
const MAX_TV_DETAILS = 48;
const CACHE_MS = 6 * 60 * 60 * 1000;

interface UpcomingTitle {
  kind: "film" | "show" | "episode";
  tmdbId: number;
  title: string;
  releaseDate: string;
  year?: number;
  overview?: string;
  detail?: string;
}

let cache: { expires: number; films: UpcomingTitle[]; shows: UpcomingTitle[] } | null = null;

export async function GET() {
  try {
    const today = isoDate(utcToday());
    const schedule = await loadSchedule();
    return Response.json({
      films: schedule.films.filter((item) => item.releaseDate >= today),
      shows: schedule.shows.filter((item) => item.releaseDate >= today),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load upcoming titles.";
    const status = message.includes("TMDBKey") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}

async function loadSchedule(): Promise<{ films: UpcomingTitle[]; shows: UpcomingTitle[] }> {
  if (cache && cache.expires > Date.now()) {
    return cache;
  }

  const films = await loadFilms();
  const shows = await loadShows().catch(() => [] as UpcomingTitle[]);
  cache = { expires: Date.now() + CACHE_MS, films, shows };
  return cache;
}

async function loadFilms(): Promise<UpcomingTitle[]> {
  const today = utcToday();
  const until = addYears(today, HORIZON_YEARS);
  const start = isoDate(today);
  const end = isoDate(until);
  const films: UpcomingTitle[] = [];
  const seen = new Set<number>();
  let pages = 1;

  for (let page = 1; page <= pages && page <= MAX_PAGES; page += 1) {
    const payload = await tmdbJson(
      `/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}` +
        `&sort_by=primary_release_date.asc&with_genres=${HORROR_GENRE}` +
        `&primary_release_date.gte=${encodeURIComponent(start)}` +
        `&primary_release_date.lte=${encodeURIComponent(end)}`,
    );
    pages = pageCount(payload, MAX_PAGES);
    for (const item of asResults(payload)) {
      const tmdbId = Number(item.id);
      const title = String(item.title ?? "").trim();
      const releaseDate = String(item.release_date ?? "").trim();
      if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title || !releaseDate || seen.has(tmdbId)) {
        continue;
      }

      const date = parseDate(releaseDate);
      if (!date || date < today || date > until) {
        continue;
      }

      seen.add(tmdbId);
      const overview = trimOverview(String(item.overview ?? "").trim());
      films.push({
        kind: "film",
        tmdbId,
        title,
        releaseDate: isoDate(date),
        year: date.getUTCFullYear(),
        ...(overview ? { overview } : {}),
      });
    }
  }

  return sortTitles(films);
}

async function loadShows(): Promise<UpcomingTitle[]> {
  const today = utcToday();
  const until = addYears(today, HORIZON_YEARS);
  const [premieres, episodeIds] = await Promise.all([loadShowPremieres(today, until), collectEpisodeShowIds(today)]);
  const episodes = await loadNextEpisodes(episodeIds, today, until);
  const premiereDates = new Set(episodes.map((item) => `${item.tmdbId}:${item.releaseDate}`));
  return sortTitles(premieres.filter((item) => !premiereDates.has(`${item.tmdbId}:${item.releaseDate}`)).concat(episodes));
}

async function loadShowPremieres(today: Date, until: Date): Promise<UpcomingTitle[]> {
  const start = isoDate(today);
  const end = isoDate(until);
  const shows: UpcomingTitle[] = [];
  const seen = new Set<number>();
  let pages = 1;

  for (let page = 1; page <= pages && page <= MAX_PAGES; page += 1) {
    const payload = await tmdbJson(
      `/discover/tv?include_adult=false&language=en-US&page=${page}` +
        `&sort_by=first_air_date.asc` +
        `&first_air_date.gte=${encodeURIComponent(start)}` +
        `&first_air_date.lte=${encodeURIComponent(end)}`,
    );
    pages = pageCount(payload, MAX_PAGES);
    for (const item of asResults(payload)) {
      const tmdbId = Number(item.id);
      const title = String(item.name ?? "").trim();
      const releaseDate = String(item.first_air_date ?? "").trim();
      if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title || !releaseDate || seen.has(tmdbId) || !looksLikeHorrorTv(item)) {
        continue;
      }

      const date = parseDate(releaseDate);
      if (!date || date < today || date > until) {
        continue;
      }

      seen.add(tmdbId);
      const overview = trimOverview(String(item.overview ?? "").trim());
      shows.push({
        kind: "show",
        tmdbId,
        title,
        releaseDate: isoDate(date),
        year: date.getUTCFullYear(),
        detail: "New series",
        ...(overview ? { overview } : {}),
      });
    }
  }

  return shows;
}

async function collectEpisodeShowIds(today: Date): Promise<number[]> {
  const until = addDays(today, EPISODE_HORIZON_DAYS);
  const ids = new Set<number>();
  await collectIds(
    `/discover/tv?include_adult=false&language=en-US` +
      `&air_date.gte=${encodeURIComponent(isoDate(today))}&air_date.lte=${encodeURIComponent(isoDate(until))}`,
    MAX_EPISODE_PAGES,
    ids,
    true,
  );
  await collectIds("/tv/airing_today?language=en-US", 2, ids, true);
  await collectIds("/tv/on_the_air?language=en-US", 2, ids, true);
  return [...ids];
}

async function collectIds(path: string, maxPages: number, ids: Set<number>, requireHorror: boolean): Promise<void> {
  let pages = 1;
  for (let page = 1; page <= pages && page <= maxPages && ids.size < MAX_TV_DETAILS; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const payload = await tmdbJsonOptional(`${path}${separator}page=${page}`);
    if (!payload) {
      break;
    }

    pages = pageCount(payload, maxPages);
    for (const item of asResults(payload)) {
      if (requireHorror && !looksLikeHorrorTv(item)) {
        continue;
      }

      const tmdbId = Number(item.id);
      if (Number.isInteger(tmdbId) && tmdbId > 0) {
        ids.add(tmdbId);
      }
    }
  }
}

async function loadNextEpisodes(showIds: number[], today: Date, until: Date): Promise<UpcomingTitle[]> {
  const ids = [...new Set(showIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_TV_DETAILS);
  const documents = await Promise.all(ids.map((id) => tmdbJsonOptional(`/tv/${id}?language=en-US&append_to_response=keywords`)));
  const episodes: UpcomingTitle[] = [];
  documents.forEach((payload, index) => {
    if (!payload || !isHorrorTvShow(payload)) {
      return;
    }

    const next = asObject(payload.next_episode_to_air);
    const showTitle = String(payload.name ?? "").trim();
    const airDate = String(next?.air_date ?? "").trim();
    const date = parseDate(airDate);
    if (!showTitle || !date || date < today || date > until) {
      return;
    }

    const season = Number(next?.season_number);
    const episode = Number(next?.episode_number);
    const episodeName = String(next?.name ?? "").trim();
    const overview =
      trimOverview(String(next?.overview ?? "").trim()) || trimOverview(String(payload.overview ?? "").trim());
    const detail = formatEpisodeDetail(season, episode, episodeName);
    episodes.push({
      kind: "episode",
      tmdbId: ids[index],
      title: showTitle,
      releaseDate: isoDate(date),
      year: date.getUTCFullYear(),
      ...(overview ? { overview } : {}),
      ...(detail ? { detail } : {}),
    });
  });
  return episodes;
}

function formatEpisodeDetail(season: number, episode: number, name: string): string | undefined {
  const code = Number.isInteger(season) && season > 0 && Number.isInteger(episode) && episode > 0 ? `S${season} E${episode}` : "";
  if (code && name) {
    return `${code} · ${name}`;
  }

  return code || name || undefined;
}

function utcToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function pageCount(payload: Record<string, unknown>, maxPages: number): number {
  return Math.min(Math.max(Number(payload.total_pages) || 1, 1), maxPages);
}

function looksLikeHorrorTv(item: Record<string, unknown>): boolean {
  if (hasExcludedTvGenreIds(item)) {
    return false;
  }

  const text = `${item.name ?? ""} ${item.overview ?? ""}`.toLowerCase();
  return HORROR_KEYWORD_HINTS.some((hint) => text.includes(hint));
}

function isHorrorTvShow(payload: Record<string, unknown>): boolean {
  if (hasExcludedTvGenresObject(payload)) {
    return false;
  }

  return hasHorrorKeyword(payload) || looksLikeHorrorTv(payload);
}

function hasHorrorKeyword(payload: Record<string, unknown>): boolean {
  const keywords = asObject(payload.keywords);
  const list = Array.isArray(keywords?.results) ? keywords.results : Array.isArray(keywords?.keywords) ? keywords.keywords : [];
  return list.some((value) => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const item = value as { id?: unknown; name?: unknown };
    const name = String(item.name ?? "").toLowerCase();
    return Number(item.id) === HORROR_KEYWORD || HORROR_KEYWORD_HINTS.some((hint) => name.includes(hint));
  });
}

function hasExcludedTvGenreIds(item: Record<string, unknown>): boolean {
  return Array.isArray(item.genre_ids) && item.genre_ids.some((value) => EXCLUDED_TV_GENRES.has(Number(value)));
}

function hasExcludedTvGenresObject(payload: Record<string, unknown>): boolean {
  return (
    Array.isArray(payload.genres) &&
    payload.genres.some((item) => item && typeof item === "object" && EXCLUDED_TV_GENRES.has(Number((item as { id?: unknown }).id)))
  );
}

function parseDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function trimOverview(overview: string): string {
  if (!overview) {
    return "";
  }

  return overview.length <= 400 ? overview : `${overview.slice(0, 397).trimEnd()}…`;
}

function sortTitles(items: UpcomingTitle[]): UpcomingTitle[] {
  return items.sort((left, right) => left.releaseDate.localeCompare(right.releaseDate) || left.title.localeCompare(right.title));
}
