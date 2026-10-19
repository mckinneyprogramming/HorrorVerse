import { parsePosterPath } from "./catalog";

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

export interface UserProgress {
  ids: string[];
  recentIds: string[];
  undatedIds: string[];
  watchedYears: Record<string, number>;
  scores: Record<string, number>;
  recentPosters: Record<string, string>;
  watchNext: WatchNextItem[];
  readNext: WatchNextItem[];
}

export async function fetchProgress(): Promise<UserProgress> {
  const response = await fetch("/api/progress");
  if (response.status === 401) {
    return emptyProgress();
  }

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readProgress(await response.json());
}

export async function fetchProgressIds(): Promise<string[]> {
  return (await fetchProgress()).ids;
}

export async function setProgress(
  id: string,
  completed: boolean,
  options: { dated?: boolean; year?: number } = {},
): Promise<UserProgress> {
  const response = await fetch("/api/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      completed,
      dated: options.dated !== false,
      ...(options.year !== undefined ? { year: options.year } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readProgress(await response.json());
}

export async function setScore(id: string, score: number | null): Promise<UserProgress> {
  const response = await fetch("/api/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, score }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readProgress(await response.json());
}

export function readWatchedYears(payload: unknown): Record<string, number> {
  if (typeof payload !== "object" || payload === null || !("watchedYears" in payload)) {
    return {};
  }

  const value = (payload as { watchedYears: unknown }).watchedYears;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const years: Record<string, number> = {};
  for (const [id, year] of Object.entries(value)) {
    if (typeof year === "number" && Number.isInteger(year)) {
      years[id] = year;
    }
  }

  return years;
}

export function readScores(payload: unknown): Record<string, number> {
  if (typeof payload !== "object" || payload === null || !("scores" in payload)) {
    return {};
  }

  const value = (payload as { scores: unknown }).scores;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const scores: Record<string, number> = {};
  for (const [id, score] of Object.entries(value)) {
    if (typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= 5) {
      scores[id] = score;
    }
  }

  return scores;
}

function readProgress(payload: unknown): UserProgress {
  return {
    ids: readIds(payload, "ids"),
    recentIds: readIds(payload, "recentIds"),
    undatedIds: readIds(payload, "undatedIds"),
    watchedYears: readWatchedYears(payload),
    scores: readScores(payload),
    recentPosters: readRecentPosters(payload),
    watchNext: readWatchNext(payload),
    readNext: readWatchNext(payload, "readNext"),
  };
}

export function readWatchNext(payload: unknown, key: "watchNext" | "readNext" = "watchNext"): WatchNextItem[] {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return [];
  }

  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => readWatchNextItem(item))
    .filter((item): item is WatchNextItem => item !== undefined);
}

function readWatchNextItem(value: unknown): WatchNextItem | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const item = value as Record<string, unknown>;
  const kind = item.kind;
  const reason = item.reason;
  if (
    (kind !== "movie" && kind !== "documentary" && kind !== "show" && kind !== "book") ||
    (reason !== "episode" && reason !== "series" && reason !== "list" && reason !== "vault") ||
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    !item.id ||
    !item.title.trim()
  ) {
    return undefined;
  }

  const detail = typeof item.detail === "string" && item.detail.trim() ? item.detail.trim() : undefined;
  const posterPath = parsePosterPath(item.posterPath);
  return {
    id: item.id,
    title: item.title.trim(),
    kind,
    reason,
    ...(detail ? { detail } : {}),
    ...(posterPath ? { posterPath } : {}),
  };
}

export function readRecentPosters(payload: unknown): Record<string, string> {
  if (typeof payload !== "object" || payload === null || !("recentPosters" in payload)) {
    return {};
  }

  const value = (payload as { recentPosters: unknown }).recentPosters;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const posters: Record<string, string> = {};
  for (const [id, path] of Object.entries(value)) {
    const parsed = parsePosterPath(path);
    if (parsed) {
      posters[id] = parsed;
    }
  }

  return posters;
}

function readIds(payload: unknown, key: "ids" | "recentIds" | "undatedIds"): string[] {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return [];
  }

  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((id): id is string => typeof id === "string");
}

function emptyProgress(): UserProgress {
  return { ids: [], recentIds: [], undatedIds: [], watchedYears: {}, scores: {}, recentPosters: {}, watchNext: [], readNext: [] };
}

async function readError(response: Response, label: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `${label} request failed (${response.status})`;
}
