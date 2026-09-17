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
