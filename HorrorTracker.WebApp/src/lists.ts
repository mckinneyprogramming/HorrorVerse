export interface UserList {
  id: number;
  name: string;
  items: string[];
}

export async function fetchLists(): Promise<UserList[]> {
  const response = await fetch("/api/lists");
  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await readError(response, "Lists"));
  }

  return readLists(await response.json());
}

export async function createList(name: string): Promise<UserList[]> {
  return writeLists("POST", "/api/lists", { name });
}

export async function renameList(id: number, name: string): Promise<UserList[]> {
  return writeLists("PATCH", "/api/lists", { id, name });
}

export async function deleteList(id: number): Promise<UserList[]> {
  const response = await fetch(`/api/lists?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await readError(response, "Lists"));
  }

  return readLists(await response.json());
}

export async function addListItem(listId: number, itemId: string): Promise<UserList[]> {
  return writeLists("POST", "/api/lists", { listId, itemId });
}

export async function addFranchiseToList(listId: number, franchiseId: number): Promise<UserList[]> {
  return writeLists("POST", "/api/lists", { listId, franchiseId });
}

export async function removeFranchiseFromList(listId: number, franchiseId: number): Promise<UserList[]> {
  const response = await fetch(
    `/api/lists?listId=${encodeURIComponent(String(listId))}&franchiseId=${encodeURIComponent(String(franchiseId))}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Lists"));
  }

  return readLists(await response.json());
}

export async function removeListItem(listId: number, itemId: string): Promise<UserList[]> {
  const response = await fetch(
    `/api/lists?listId=${encodeURIComponent(String(listId))}&itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Lists"));
  }

  return readLists(await response.json());
}

async function writeLists(method: "POST" | "PATCH", path: string, body: Record<string, unknown>): Promise<UserList[]> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Lists"));
  }

  return readLists(await response.json());
}

function readLists(payload: unknown): UserList[] {
  if (typeof payload !== "object" || payload === null || !("lists" in payload) || !Array.isArray(payload.lists)) {
    return [];
  }

  return payload.lists
    .map((value) => {
      if (typeof value !== "object" || value === null) {
        return null;
      }

      const list = value as Partial<UserList>;
      if (typeof list.id !== "number" || typeof list.name !== "string" || !Array.isArray(list.items)) {
        return null;
      }

      return {
        id: list.id,
        name: list.name,
        items: list.items.filter((item): item is string => typeof item === "string"),
      };
    })
    .filter((list): list is UserList => list !== null);
}

async function readError(response: Response, label: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `${label} request failed (${response.status})`;
}
