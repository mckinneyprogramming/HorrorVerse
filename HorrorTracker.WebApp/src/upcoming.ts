export type UpcomingKind = "film" | "show" | "episode";

export interface UpcomingTitle {
  kind: UpcomingKind;
  tmdbId: number;
  title: string;
  releaseDate: string;
  year?: number;
  overview?: string;
  detail?: string;
}

export interface UpcomingSchedule {
  films: UpcomingTitle[];
  shows: UpcomingTitle[];
}

export async function fetchUpcoming(): Promise<UpcomingSchedule> {
  const response = await fetch("/api/upcoming");
  const payload = (await response.json().catch(() => ({}))) as { films?: unknown; shows?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Upcoming titles failed (${response.status})`);
  }

  return {
    films: readList(payload.films, "film"),
    shows: readList(payload.shows),
  };
}

function readList(value: unknown, fallbackKind?: UpcomingKind): UpcomingTitle[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => readTitle(item, fallbackKind)).filter((item): item is UpcomingTitle => item !== null);
}

function readTitle(value: unknown, fallbackKind?: UpcomingKind): UpcomingTitle | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tmdbId = Number(record.tmdbId ?? record.TmdbId);
  const title = String(record.title ?? record.Title ?? "").trim();
  const releaseDate = String(record.releaseDate ?? record.ReleaseDate ?? "").trim();
  if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return null;
  }

  const rawKind = String(record.kind ?? record.Kind ?? fallbackKind ?? "").trim().toLowerCase();
  const kind: UpcomingKind = rawKind === "show" || rawKind === "episode" || rawKind === "film" ? rawKind : fallbackKind ?? "film";
  const yearValue = Number(record.year ?? record.Year ?? releaseDate.slice(0, 4));
  const overview = String(record.overview ?? record.Overview ?? "").trim();
  const detail = String(record.detail ?? record.Detail ?? "").trim();
  return {
    kind,
    tmdbId,
    title,
    releaseDate,
    ...(Number.isInteger(yearValue) && yearValue >= 1888 ? { year: yearValue } : {}),
    ...(overview ? { overview } : {}),
    ...(detail ? { detail } : {}),
  };
}
