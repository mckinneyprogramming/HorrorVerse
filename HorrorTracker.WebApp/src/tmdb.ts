export async function searchTmdb(kind: string, query: string): Promise<TmdbHit[]> {
  const response = await fetch(`/api/tmdb?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query)}`);
  const payload = (await response.json().catch(() => ({}))) as { results?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `TMDb search failed (${response.status})`);
  }

  if (!Array.isArray(payload.results)) {
    return [];
  }

  return payload.results.map(readHit).filter((hit): hit is TmdbHit => hit !== null);
}

export async function importTmdb(kind: string, tmdbId: number | string): Promise<string> {
  const response = await fetch("/api/tmdb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(typeof tmdbId === "string" ? { kind, sourceId: tmdbId } : { kind, tmdbId }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: unknown };
  if (!response.ok) {
    throw new Error(payload.error ?? `TMDb import failed (${response.status})`);
  }

  const id = String(payload.id ?? "").trim();
  if (!id) {
    throw new Error("TMDb import did not return a catalog title.");
  }

  return id;
}

export interface TmdbHit {
  tmdbId?: number;
  sourceId?: string;
  title: string;
  year?: number;
  overview?: string;
  coverUrl?: string;
}

function readHit(value: unknown): TmdbHit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tmdbId = Number(record.tmdbId ?? record.TmdbId);
  const sourceId = String(record.sourceId ?? record.SourceId ?? "").trim();
  const title = String(record.title ?? record.Title ?? "").trim();
  const hasTmdbId = Number.isInteger(tmdbId) && tmdbId >= 1;
  if ((!hasTmdbId && !/^OL\d+W$/.test(sourceId)) || title.length < 1) {
    return null;
  }

  const yearValue = Number(record.year ?? record.Year);
  const overview = String(record.overview ?? record.Overview ?? "").trim();
  const coverUrl = String(record.coverUrl ?? record.CoverUrl ?? "").trim();
  return {
    ...(hasTmdbId ? { tmdbId } : {}),
    ...(sourceId ? { sourceId } : {}),
    title,
    ...(Number.isInteger(yearValue) && yearValue >= 1 && yearValue <= 3000 ? { year: yearValue } : {}),
    ...(overview ? { overview } : {}),
    ...(coverUrl.startsWith("https://covers.openlibrary.org/") ? { coverUrl } : {}),
  };
}
