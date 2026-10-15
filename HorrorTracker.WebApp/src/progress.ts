export interface UserProgress {
  ids: string[];
  recentIds: string[];
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

export async function setProgress(id: string, completed: boolean): Promise<UserProgress> {
  const response = await fetch("/api/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, completed }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readProgress(await response.json());
}

function readProgress(payload: unknown): UserProgress {
  return {
    ids: readIds(payload, "ids"),
    recentIds: readIds(payload, "recentIds"),
  };
}

function readIds(payload: unknown, key: "ids" | "recentIds"): string[] {
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
  return { ids: [], recentIds: [] };
}

async function readError(response: Response, label: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `${label} request failed (${response.status})`;
}
