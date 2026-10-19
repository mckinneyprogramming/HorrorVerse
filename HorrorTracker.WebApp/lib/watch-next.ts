import { queryRows } from "./neon";
import { parsePosterPath } from "./poster";

export const WATCH_NEXT_LIMIT = 6;

export type WatchNextKind = "movie" | "documentary" | "show" | "book";
export type WatchNextReason = "episode" | "series" | "list" | "vault";

export interface WatchNextItem {
  id: string;
  title: string;
  kind: WatchNextKind;
  reason: WatchNextReason;
  detail?: string;
  posterPath?: string;
}

export interface WatchNextSource {
  episodes: WatchNextItem[];
  series: WatchNextItem[];
  listed: WatchNextItem[];
  vault: WatchNextItem[];
}

export function dailyWatchNextSeed(userId: number, now = new Date()): number {
  return userId * 10_000 + now.getUTCFullYear() * 400 + (now.getUTCMonth() + 1) * 32 + now.getUTCDate();
}

export function pickWatchNext(source: WatchNextSource, limit = WATCH_NEXT_LIMIT, seed = 0): WatchNextItem[] {
  const picked: WatchNextItem[] = [];
  const seen = new Set<string>();
  const add = (items: WatchNextItem[]): void => {
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

export async function loadWatchNext(connectionString: string, userId: number): Promise<WatchNextItem[]> {
  const [episodes, series, listed, vault] = await Promise.all([
    loadNextEpisodes(connectionString, userId),
    loadNextSeriesMovies(connectionString, userId),
    loadListedUnfinished(connectionString, userId),
    loadVaultUnfinished(connectionString, userId),
  ]);
  return pickWatchNext({ episodes, series, listed, vault }, WATCH_NEXT_LIMIT, dailyWatchNextSeed(userId));
}

export async function loadReadNext(connectionString: string, userId: number): Promise<WatchNextItem[]> {
  const [listed, vault] = await Promise.all([
    loadListedBooks(connectionString, userId),
    loadVaultBooks(connectionString, userId),
  ]);
  return pickWatchNext({ episodes: [], series: [], listed, vault }, WATCH_NEXT_LIMIT, dailyWatchNextSeed(userId));
}

async function loadNextEpisodes(connectionString: string, userId: number): Promise<WatchNextItem[]> {
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
      [userId],
    );
    return rows
      .map((row) => {
        const item = toItem("show", row.id, row.title, row.posterpath, "episode", episodeDetail(row.season_number, row.episode_number, row.episode_title));
        return item ? { item, at: Date.parse(String(row.last_watched ?? "")) || 0 } : undefined;
      })
      .filter((row): row is { item: WatchNextItem; at: number } => row !== undefined)
      .sort((left, right) => right.at - left.at)
      .map((row) => row.item);
  } catch {
    return [];
  }
}

async function loadNextSeriesMovies(connectionString: string, userId: number): Promise<WatchNextItem[]> {
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
      [userId],
    );
    return rows
      .map((row) => {
        const item = toItem("movie", row.id, row.title, row.posterpath, "series", joinDetail(row.series_title, row.releaseyear));
        return item ? { item, at: Date.parse(String(row.last_watched ?? "")) || 0 } : undefined;
      })
      .filter((row): row is { item: WatchNextItem; at: number } => row !== undefined)
      .sort((left, right) => right.at - left.at)
      .map((row) => row.item);
  } catch {
    return [];
  }
}

async function loadListedUnfinished(connectionString: string, userId: number): Promise<WatchNextItem[]> {
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
       `,
      [userId],
    );
    return rows
      .map((row) => toItem(row.kind, row.id, row.title, row.posterpath, "list", yearDetail(row.releaseyear)))
      .filter((item): item is WatchNextItem => item !== undefined);
  } catch {
    return [];
  }
}

async function loadVaultUnfinished(connectionString: string, userId: number): Promise<WatchNextItem[]> {
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
       `,
      [userId],
    );
    return rows
      .map((row) => toItem(row.kind, row.id, row.title, row.posterpath, "vault", yearDetail(row.releaseyear)))
      .filter((item): item is WatchNextItem => item !== undefined);
  } catch {
    return [];
  }
}

async function loadListedBooks(connectionString: string, userId: number): Promise<WatchNextItem[]> {
  try {
    const rows = await queryRows(
      connectionString,
      `SELECT 'book' AS kind, b.id, b.title, NULL AS posterpath, b.releaseyear
       FROM user_list_item i
       JOIN user_list l ON l.id = i.list_id
       JOIN book b ON b.id = i.media_id
       WHERE l.user_id = $1 AND i.media_kind = 'book'
         AND NOT EXISTS (
           SELECT 1 FROM user_media_progress p
           WHERE p.user_id = $1 AND p.media_kind = 'book' AND p.media_id = b.id
         )`,
      [userId],
    );
    return rows
      .map((row) => toItem(row.kind, row.id, row.title, row.posterpath, "list", yearDetail(row.releaseyear)))
      .filter((item): item is WatchNextItem => item !== undefined);
  } catch {
    return [];
  }
}

async function loadVaultBooks(connectionString: string, userId: number): Promise<WatchNextItem[]> {
  try {
    const rows = await queryRows(
      connectionString,
      `SELECT 'book' AS kind, id, title, NULL AS posterpath, releaseyear FROM book b
       WHERE NOT EXISTS (
         SELECT 1 FROM user_media_progress p
         WHERE p.user_id = $1 AND p.media_kind = 'book' AND p.media_id = b.id
       )
       ORDER BY id
       LIMIT 20`,
      [userId],
    );
    return rows
      .map((row) => toItem(row.kind, row.id, row.title, row.posterpath, "vault", yearDetail(row.releaseyear)))
      .filter((item): item is WatchNextItem => item !== undefined);
  } catch {
    return [];
  }
}

function toItem(
  kind: unknown,
  id: unknown,
  title: unknown,
  poster: unknown,
  reason: WatchNextReason,
  detail?: string,
): WatchNextItem | undefined {
  if (kind !== "movie" && kind !== "documentary" && kind !== "show" && kind !== "book") {
    return undefined;
  }

  const mediaId = Number(id);
  const name = String(title ?? "").trim();
  if (!Number.isInteger(mediaId) || mediaId < 1 || !name) {
    return undefined;
  }

  const posterPath = parsePosterPath(poster);
  return {
    id: `${kind}:${mediaId}`,
    title: name,
    kind,
    reason,
    ...(detail ? { detail } : {}),
    ...(posterPath ? { posterPath } : {}),
  };
}

function episodeDetail(season: unknown, episode: unknown, title: unknown): string | undefined {
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const name = String(title ?? "").trim();
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return name || undefined;
  }

  const seasonLabel = seasonNumber === 0 ? "Specials" : `S${seasonNumber}`;
  const prefix = `${seasonLabel} E${episodeNumber}`;
  return name ? `${prefix} · ${name}` : prefix;
}

function joinDetail(seriesTitle: unknown, year: unknown): string | undefined {
  return [String(seriesTitle ?? "").trim(), yearDetail(year)].filter(Boolean).join(" · ") || undefined;
}

function yearDetail(year: unknown): string | undefined {
  const value = Number(year);
  return Number.isInteger(value) && value > 0 ? String(value) : undefined;
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const next = [...items];
  let value = seed >>> 0 || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const swap = value % (index + 1);
    const current = next[index];
    const other = next[swap];
    if (current === undefined || other === undefined) {
      continue;
    }

    next[index] = other;
    next[swap] = current;
  }

  return next;
}
