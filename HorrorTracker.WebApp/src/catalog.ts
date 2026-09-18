export const MEDIA_KINDS = [
  { id: "movie", label: "Movies", hint: "Films that linger after the credits." },
  { id: "series", label: "Series", hint: "Sagas told across multiple movies." },
  { id: "show", label: "TV Shows", hint: "Episodic dread, week after week." },
  { id: "documentary", label: "Documentaries", hint: "True stories from the dark." },
  { id: "book", label: "Books", hint: "Horror you can hold in your hands." },
  { id: "podcast", label: "Podcasts", hint: "Voices in the dark." },
  { id: "game", label: "Games", hint: "Fear you have to survive." },
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number]["id"];

export const WRITABLE_KINDS = MEDIA_KINDS.filter(
  (kind) => kind.id === "movie" || kind.id === "series" || kind.id === "show" || kind.id === "documentary" || kind.id === "book",
);

export interface CatalogEntry {
  id: string;
  mediaId: number;
  title: string;
  kind: MediaKind;
  completed: boolean;
}

export function isMediaKind(value: string): value is MediaKind {
  return MEDIA_KINDS.some((kind) => kind.id === value);
}

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const response = await fetch("/api/catalog");
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter(isCatalogEntry);
}

export async function createCatalogEntry(input: {
  title: string;
  kind: string;
  completed: boolean;
  releaseYear?: number;
}): Promise<CatalogEntry> {
  return writeCatalog("POST", input);
}

export async function updateCatalogEntry(input: {
  id: string;
  title: string;
  completed: boolean;
}): Promise<CatalogEntry> {
  return writeCatalog("PATCH", input);
}

export async function deleteCatalogEntry(id: string): Promise<void> {
  const response = await fetch(`/api/catalog?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    throw new Error(await readCatalogError(response));
  }
}

async function writeCatalog(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<CatalogEntry> {
  const response = await fetch("/api/catalog", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readCatalogError(response));
  }

  const payload: unknown = await response.json();
  if (!isCatalogEntry(payload)) {
    throw new Error("Catalog did not return a title.");
  }

  return payload;
}

async function readCatalogError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `Catalog request failed (${response.status})`;
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<CatalogEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.mediaId === "number" &&
    typeof entry.title === "string" &&
    typeof entry.kind === "string" &&
    isMediaKind(entry.kind) &&
    typeof entry.completed === "boolean"
  );
}
