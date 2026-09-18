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

export async function importTmdb(kind: string, tmdbId: number): Promise<void> {
  const response = await fetch("/api/tmdb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, tmdbId }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `TMDb import failed (${response.status})`);
  }
}

export interface TmdbHit {
  tmdbId: number;
  title: string;
  year?: number;
  overview?: string;
}

function readHit(value: unknown): TmdbHit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tmdbId = Number(record.tmdbId ?? record.TmdbId);
  const title = String(record.title ?? record.Title ?? "").trim();
  if (!Number.isInteger(tmdbId) || tmdbId < 1 || title.length < 1) {
    return null;
  }

  const yearValue = Number(record.year ?? record.Year);
  const overview = String(record.overview ?? record.Overview ?? "").trim();
  return {
    tmdbId,
    title,
    ...(Number.isInteger(yearValue) && yearValue >= 1888 ? { year: yearValue } : {}),
    ...(overview ? { overview } : {}),
  };
}
