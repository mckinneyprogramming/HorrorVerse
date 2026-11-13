import type { FollowUpcomingItem } from "../lib/follow-upcoming";
import type { TalentCredit, TalentFollow, TalentName, TalentPerson } from "../lib/talent-model";
import { parsePosterPath } from "./catalog";

export type { FollowUpcomingItem, TalentCredit, TalentFollow, TalentName, TalentPerson };

export async function fetchTitleTalent(titleId: string): Promise<{ directors: TalentName[]; cast: TalentName[] }> {
  const response = await fetch(`/api/talent?title=${encodeURIComponent(titleId)}`);
  const payload = (await response.json().catch(() => ({}))) as { directors?: unknown; cast?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not load the people on that title.");
  }

  return { directors: readNames(payload.directors), cast: readNames(payload.cast) };
}

export async function fetchTalentPerson(personId: number): Promise<TalentPerson> {
  const response = await fetch(`/api/talent?person=${encodeURIComponent(String(personId))}`);
  return readPerson(response, "Could not open that person.");
}

export async function fetchFollowedTalent(): Promise<TalentFollow[]> {
  const response = await fetch("/api/talent");
  const payload = (await response.json().catch(() => ({}))) as { people?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not load the people you follow.");
  }

  return readFollows(payload.people);
}

export async function fetchFollowUpcoming(): Promise<FollowUpcomingItem[]> {
  const response = await fetch("/api/talent?upcoming=1");
  const payload = (await response.json().catch(() => ({}))) as { titles?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not load upcoming titles from people you follow.");
  }

  return readFollowUpcoming(payload.titles);
}

export async function followTalent(personId: number): Promise<TalentPerson> {
  const response = await fetch("/api/talent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ personId }),
  });
  return readPerson(response, "Could not follow that person.");
}

export async function unfollowTalent(personId: number): Promise<TalentPerson> {
  const response = await fetch(`/api/talent?person=${encodeURIComponent(String(personId))}`, { method: "DELETE" });
  return readPerson(response, "Could not unfollow that person.");
}

async function readPerson(response: Response, fallback: string): Promise<TalentPerson> {
  const payload = (await response.json().catch(() => ({}))) as { person?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? fallback);
  }

  const person = readTalentPerson(payload.person);
  if (!person) {
    throw new Error(fallback);
  }

  return person;
}

function readNames(value: unknown): TalentName[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readTalentName).filter((person): person is TalentName => person !== null);
}

function readFollows(value: unknown): TalentFollow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readTalentFollow).filter((person): person is TalentFollow => person !== null);
}

function readFollowUpcoming(value: unknown): FollowUpcomingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readFollowUpcomingItem).filter((item): item is FollowUpcomingItem => item !== null);
}

function readFollowUpcomingItem(value: unknown): FollowUpcomingItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tmdbId = positiveId(record.tmdbId);
  const personId = positiveId(record.personId);
  const title = text(record.title, 200);
  const personName = text(record.personName, 200);
  const releaseDate = text(record.releaseDate, 10);
  const kind = record.kind === "film" || record.kind === "show" || record.kind === "episode" ? record.kind : undefined;
  if (!tmdbId || !personId || !title || !personName || !releaseDate || !kind || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return null;
  }

  const detail = text(record.detail, 120);
  const role = text(record.role, 120);
  const posterPath = parsePosterPath(record.posterPath);
  return {
    tmdbId,
    kind,
    title,
    releaseDate,
    personId,
    personName,
    ...(detail ? { detail } : {}),
    ...(role ? { role } : {}),
    ...(posterPath ? { posterPath } : {}),
  };
}

function readTalentName(value: unknown): TalentName | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = positiveId(record.id);
  const name = text(record.name, 200);
  if (!id || !name) {
    return null;
  }

  const profilePath = text(record.profilePath, 160);
  return {
    id,
    name,
    role: text(record.role, 120) ?? "Cast",
    ...(profilePath?.startsWith("/") ? { profilePath } : {}),
  };
}

function readTalentFollow(value: unknown): TalentFollow | null {
  const name = readTalentName(value);
  if (!name || !value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const knownFor = text(record.knownFor, 40);
  return {
    id: name.id,
    name: name.name,
    ...(name.profilePath ? { profilePath: name.profilePath } : {}),
    ...(knownFor ? { knownFor } : {}),
    watched: count(record.watched),
    total: count(record.total),
  };
}

function readTalentPerson(value: unknown): TalentPerson | null {
  const follow = readTalentFollow(value);
  if (!follow || !value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    ...follow,
    following: Boolean(record.following),
    credits: Array.isArray(record.credits) ? record.credits.map(readCredit).filter((credit): credit is TalentCredit => credit !== null) : [],
  };
}

function readCredit(value: unknown): TalentCredit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tmdbId = positiveId(record.tmdbId);
  const title = text(record.title, 200);
  const kind = record.kind === "movie" || record.kind === "documentary" || record.kind === "show" ? record.kind : undefined;
  const mediaType = record.mediaType === "tv" || record.mediaType === "movie" ? record.mediaType : undefined;
  if (!tmdbId || !title || !kind || !mediaType) {
    return null;
  }

  const year = positiveId(record.year);
  const posterPath = text(record.posterPath, 160);
  const vaultId = text(record.vaultId, 40);
  return {
    tmdbId,
    mediaType,
    kind,
    title,
    ...(year ? { year } : {}),
    ...(posterPath?.startsWith("/") ? { posterPath } : {}),
    role: text(record.role, 120) ?? "Cast",
    ...(vaultId && /^(movie|documentary|show):\d+$/.test(vaultId) ? { vaultId } : {}),
    finished: Boolean(record.finished),
  };
}

function positiveId(value: unknown): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trimEnd();
}
