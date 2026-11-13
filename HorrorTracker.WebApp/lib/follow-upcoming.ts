import type { FollowUpcomingItem } from "./talent-model";
import { queryRows } from "./neon";
import { parsePosterPath } from "./poster";
import { asId, asPositiveInt } from "./tmdb";

export type { FollowUpcomingItem };

export const FOLLOW_UPCOMING_LIMIT = 8;

export interface FollowCreditRef {
  personId: number;
  personName: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  role: string;
  posterPath?: string;
}

export interface UpcomingScheduleTitle {
  kind: "film" | "show" | "episode";
  tmdbId: number;
  title: string;
  releaseDate: string;
  detail?: string;
  posterPath?: string;
}

export function matchFollowUpcoming(
  credits: readonly FollowCreditRef[],
  schedule: { films: readonly UpcomingScheduleTitle[]; shows: readonly UpcomingScheduleTitle[] },
  limit = FOLLOW_UPCOMING_LIMIT,
): FollowUpcomingItem[] {
  const byMovie = new Map<number, FollowCreditRef>();
  const byShow = new Map<number, FollowCreditRef>();
  for (const credit of credits) {
    if (!credit.personId || !credit.personName || !credit.tmdbId) {
      continue;
    }

    const bucket = credit.mediaType === "tv" ? byShow : byMovie;
    if (!bucket.has(credit.tmdbId)) {
      bucket.set(credit.tmdbId, credit);
    }
  }

  const matched: FollowUpcomingItem[] = [];
  const seen = new Set<string>();
  for (const title of [...schedule.films, ...schedule.shows]) {
    if (!title.tmdbId || !title.title || !/^\d{4}-\d{2}-\d{2}$/.test(title.releaseDate)) {
      continue;
    }

    const credit = title.kind === "film" ? byMovie.get(title.tmdbId) : byShow.get(title.tmdbId);
    if (!credit) {
      continue;
    }

    const key = `${title.kind}:${title.tmdbId}:${title.releaseDate}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const posterPath = title.posterPath ?? credit.posterPath;
    const role = credit.role.trim();
    matched.push({
      tmdbId: title.tmdbId,
      kind: title.kind,
      title: title.title,
      releaseDate: title.releaseDate,
      ...(title.detail ? { detail: title.detail } : {}),
      ...(posterPath ? { posterPath } : {}),
      personId: credit.personId,
      personName: credit.personName,
      ...(role ? { role } : {}),
    });
  }

  return matched
    .sort((left, right) => left.releaseDate.localeCompare(right.releaseDate) || left.title.localeCompare(right.title))
    .slice(0, Math.max(0, limit));
}

export async function loadFollowCredits(connectionString: string, userId: number): Promise<FollowCreditRef[]> {
  const rows = await queryRows(
    connectionString,
    `SELECT f.person_id, f.name, t.tmdb_id, t.media_type, t.role, t.poster_path
     FROM user_talent_follow f
     JOIN talent_filmography t ON t.person_id = f.person_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC, t.title`,
    [userId],
  );
  const credits: FollowCreditRef[] = [];
  for (const row of rows) {
    const personId = asId(row, "person_id");
    const personName = String(row.name ?? "").trim();
    const tmdbId = asPositiveInt(row.tmdb_id);
    const mediaType = row.media_type === "tv" || row.media_type === "movie" ? row.media_type : undefined;
    if (!personId || !personName || !tmdbId || !mediaType) {
      continue;
    }

    const posterPath = parsePosterPath(row.poster_path);
    credits.push({
      personId,
      personName,
      tmdbId,
      mediaType,
      role: String(row.role ?? "").trim() || "Cast",
      ...(posterPath ? { posterPath } : {}),
    });
  }

  return credits;
}
