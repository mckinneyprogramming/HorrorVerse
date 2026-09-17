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
  title: string;
  kind: MediaKind;
  completed: boolean;
  createdAt: string;
}

const STORAGE_KEY = "horrorverse.catalog.v1";

export function isMediaKind(value: string): value is MediaKind {
  return MEDIA_KINDS.some((kind) => kind.id === value);
}

export function loadCatalog(): CatalogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isCatalogEntry);
  } catch {
    return [];
  }
}

export function saveCatalog(entries: CatalogEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function createEntry(title: string, kind: MediaKind): CatalogEntry {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    kind,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<CatalogEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.kind === "string" &&
    isMediaKind(entry.kind) &&
    typeof entry.completed === "boolean" &&
    typeof entry.createdAt === "string"
  );
}
