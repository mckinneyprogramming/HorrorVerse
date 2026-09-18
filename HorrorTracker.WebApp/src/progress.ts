export async function fetchProgressIds(): Promise<string[]> {
  const response = await fetch("/api/progress");
  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readIds(await response.json());
}

export async function setProgress(id: string, completed: boolean): Promise<string[]> {
  const response = await fetch("/api/progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, completed }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Progress"));
  }

  return readIds(await response.json());
}

function readIds(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null || !("ids" in payload) || !Array.isArray(payload.ids)) {
    return [];
  }

  return payload.ids.filter((id): id is string => typeof id === "string");
}

async function readError(response: Response, label: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `${label} request failed (${response.status})`;
}
