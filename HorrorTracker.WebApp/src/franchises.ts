export interface Franchise {
  id: number;
  name: string;
  items: string[];
}

export const FRANCHISE_KINDS = ["series", "movie", "show", "book"] as const;

export type FranchiseKind = (typeof FRANCHISE_KINDS)[number];

export const FRANCHISE_KIND_OPTIONS: { id: FranchiseKind; label: string }[] = [
  { id: "series", label: "Series" },
  { id: "movie", label: "Movies" },
  { id: "show", label: "TV Shows" },
  { id: "book", label: "Books" },
];

export function isFranchiseKind(value: string): value is FranchiseKind {
  return (FRANCHISE_KINDS as readonly string[]).includes(value);
}

export async function fetchFranchises(): Promise<Franchise[]> {
  const response = await fetch("/api/franchises");
  if (!response.ok) {
    throw new Error(await readError(response, "Franchises"));
  }

  return readFranchises(await response.json());
}

export async function createFranchise(name: string): Promise<Franchise[]> {
  return writeFranchises("POST", "/api/franchises", { name });
}

export async function renameFranchise(id: number, name: string): Promise<Franchise[]> {
  return writeFranchises("PATCH", "/api/franchises", { id, name });
}

export async function deleteFranchise(id: number): Promise<Franchise[]> {
  const response = await fetch(`/api/franchises?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await readError(response, "Franchises"));
  }

  return readFranchises(await response.json());
}

export async function addFranchiseItem(franchiseId: number, itemId: string): Promise<Franchise[]> {
  return writeFranchises("POST", "/api/franchises", { franchiseId, itemId });
}

export async function removeFranchiseItem(franchiseId: number, itemId: string): Promise<Franchise[]> {
  const response = await fetch(
    `/api/franchises?franchiseId=${encodeURIComponent(String(franchiseId))}&itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Franchises"));
  }

  return readFranchises(await response.json());
}

async function writeFranchises(method: "POST" | "PATCH", path: string, body: Record<string, unknown>): Promise<Franchise[]> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Franchises"));
  }

  return readFranchises(await response.json());
}

function readFranchises(payload: unknown): Franchise[] {
  if (typeof payload !== "object" || payload === null || !("franchises" in payload) || !Array.isArray(payload.franchises)) {
    return [];
  }

  return payload.franchises
    .map((value) => {
      if (typeof value !== "object" || value === null) {
        return null;
      }

      const record = value as Record<string, unknown>;
      const id = Number(record.id ?? record.Id);
      const name = String(record.name ?? record.Name ?? "").trim();
      const rawItems = record.items ?? record.Items;
      if (!Number.isInteger(id) || id < 1 || !name || !Array.isArray(rawItems)) {
        return null;
      }

      return {
        id,
        name,
        items: rawItems.filter((item): item is string => typeof item === "string"),
      };
    })
    .filter((franchise): franchise is Franchise => franchise !== null);
}

async function readError(response: Response, label: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `${label} request failed (${response.status})`;
}
