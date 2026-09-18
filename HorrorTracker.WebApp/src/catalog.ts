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
  totalTime?: number;
  releaseYear?: number;
  seriesId?: number;
  seriesTitle?: string;
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

  return payload.map(readCatalogEntry).filter((entry): entry is CatalogEntry => entry !== null);
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
  const entry = readCatalogEntry(payload);
  if (!entry) {
    throw new Error("Catalog did not return a title.");
  }

  return entry;
}

async function readCatalogError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `Catalog request failed (${response.status})`;
}

function readCatalogEntry(value: unknown): CatalogEntry | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const entry = value as Partial<CatalogEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.mediaId !== "number" ||
    typeof entry.title !== "string" ||
    typeof entry.kind !== "string" ||
    !isMediaKind(entry.kind) ||
    typeof entry.completed !== "boolean"
  ) {
    return null;
  }

  const totalTime = optionalPositiveNumber(entry.totalTime);
  const releaseYear = optionalPositiveNumber(entry.releaseYear);
  const seriesId = optionalPositiveNumber(entry.seriesId);
  const seriesTitle = optionalText(entry.seriesTitle);

  return {
    id: entry.id,
    mediaId: entry.mediaId,
    title: entry.title,
    kind: entry.kind,
    completed: entry.completed,
    ...(totalTime !== undefined ? { totalTime } : {}),
    ...(releaseYear !== undefined ? { releaseYear } : {}),
    ...(seriesId !== undefined ? { seriesId } : {}),
    ...(seriesTitle !== undefined ? { seriesTitle } : {}),
  };
}

function optionalPositiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function movieDetailLine(entry: CatalogEntry): string | undefined {
  if (entry.kind !== "movie") {
    return undefined;
  }

  const parts: string[] = [];
  if (entry.seriesTitle) {
    parts.push(entry.seriesTitle);
  }

  if (entry.releaseYear) {
    parts.push(String(entry.releaseYear));
  }

  const runtime = formatRuntime(entry.totalTime);
  if (runtime) {
    parts.push(runtime);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatRuntime(totalMinutes: number | undefined): string | undefined {
  if (totalMinutes === undefined) {
    return undefined;
  }

  const minutes = Math.round(totalMinutes);
  if (minutes < 1) {
    return undefined;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) {
    return `${hours} hr ${rest} min`;
  }

  if (hours > 0) {
    return hours === 1 ? "1 hr" : `${hours} hr`;
  }

  return `${rest} min`;
}
