import { importMovie } from "./import-tmdb";
import { asResults, tmdbJson } from "./tmdb";

const HORROR_GENRE = 27;
const MAX_PAGES = 3;
const MAX_IMPORTS = 24;

export function releaseDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function importFilmsReleasingToday(
  connectionString: string,
  now = new Date(),
): Promise<{ date: string; added: number; already: number; failed: number }> {
  const date = releaseDay(now);
  const ids = await horrorFilmIdsOn(date);
  let added = 0;
  let already = 0;
  let failed = 0;
  for (const tmdbId of ids) {
    try {
      const result = await importMovie(connectionString, tmdbId);
      if (result.added > 0) {
        added += result.added;
      } else {
        already += 1;
      }
    } catch (error) {
      failed += 1;
      console.error("Could not import today's release.", tmdbId, error instanceof Error ? error.message : error);
    }
  }

  return { date, added, already, failed };
}

async function horrorFilmIdsOn(date: string): Promise<number[]> {
  const ids: number[] = [];
  const seen = new Set<number>();
  let pages = 1;
  for (let page = 1; page <= pages && page <= MAX_PAGES && ids.length < MAX_IMPORTS; page += 1) {
    const payload = await tmdbJson(
      `/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}` +
        `&sort_by=popularity.desc&with_genres=${HORROR_GENRE}` +
        `&primary_release_date.gte=${encodeURIComponent(date)}` +
        `&primary_release_date.lte=${encodeURIComponent(date)}`,
    );
    pages = Math.min(Math.max(Number(payload.total_pages) || 1, 1), MAX_PAGES);
    for (const item of asResults(payload)) {
      const tmdbId = Number(item.id);
      const releaseDate = String(item.release_date ?? "").trim();
      if (!Number.isInteger(tmdbId) || tmdbId < 1 || releaseDate !== date || seen.has(tmdbId)) {
        continue;
      }

      seen.add(tmdbId);
      ids.push(tmdbId);
      if (ids.length >= MAX_IMPORTS) {
        break;
      }
    }
  }

  return ids;
}
