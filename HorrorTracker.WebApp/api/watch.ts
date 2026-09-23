export const runtime = "nodejs";
export const maxDuration = 20;

import {
  execute,
  HttpError,
  jsonError,
  queryRows,
  requireDatabaseUrl,
  requireSessionUser,
} from "../lib/neon";

const TMDB_BASE = "https://api.themoviedb.org/3";
const REGION = "US";
const ATTRIBUTION = "JustWatch";

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireSessionUser(request, connectionString);
    const id = new URL(request.url).searchParams.get("id");
    return Response.json(await loadWatch(connectionString, id));
  } catch (error) {
    return jsonError(error, { log: "Watch request failed.", fallback: "Could not look up where to watch." });
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
        : "SELECT title, releaseyear, tmdbid FROM show WHERE id = $1";
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

class WatchError extends HttpError {}

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
