export interface UserProgress {
  ids: string[];
  recentIds: string[];
  undatedIds: string[];
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
  options: { dated?: boolean } = {},
): Promise<UserProgress> {
  const response = await fetch("/api/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, completed, dated: options.dated !== false }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readProgress(await response.json());
}

export function canMarkEarlier(undatedIds: readonly string[], id: string): boolean {
  return !undatedIds.includes(id);
}

function readProgress(payload: unknown): UserProgress {
  return {
    ids: readIds(payload, "ids"),
    recentIds: readIds(payload, "recentIds"),
    undatedIds: readIds(payload, "undatedIds"),
  };
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
  return { ids: [], recentIds: [], undatedIds: [] };
}

async function readError(response: Response, label: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `${label} request failed (${response.status})`;
}
