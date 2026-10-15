import type { CatalogEntry, MediaKind } from "./catalog";
import type { Franchise } from "./franchises";
import { keywordsMatchTag } from "./tags";

const TIMED_KINDS = new Set<MediaKind>(["movie", "documentary", "show"]);

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  earned: boolean;
  current: number;
  target: number;
  filter?: MediaKind | "all";
  tag?: string;
  openFranchises?: boolean;
  openLists?: boolean;
}

export interface AchievementInput {
  entries: readonly CatalogEntry[];
  finishedIds: readonly string[];
  franchises?: readonly Franchise[];
  listCount?: number;
  yearCount?: number;
}

interface AchievementContext {
  finished: Set<string>;
  entries: readonly CatalogEntry[];
  movies: number;
  books: number;
  documentaries: number;
  shows: number;
  series: number;
  franchises: number;
  hours: number;
  lists: number;
  years: number;
  tag: (id: string) => number;
}

interface AchievementDefinition {
  id: string;
  name: string;
  hint: string;
  earnedHint: string;
  target: number;
  filter?: MediaKind | "all";
  tag?: string;
  openFranchises?: boolean;
  openLists?: boolean;
  progress: (context: AchievementContext) => number;
}

const DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first-blood",
    name: "First Blood",
    hint: "Mark your first horror movie finished.",
    earnedHint: "Your first film in the vault.",
    target: 1,
    filter: "movie",
    progress: (context) => context.movies,
  },
  {
    id: "body-count",
    name: "Body Count",
    hint: "Finish 10 movies.",
    earnedHint: "Ten films marked finished.",
    target: 10,
    filter: "movie",
    progress: (context) => context.movies,
  },
  {
    id: "massacre",
    name: "Massacre",
    hint: "Finish 50 movies.",
    earnedHint: "Fifty films survived.",
    target: 50,
    filter: "movie",
    progress: (context) => context.movies,
  },
  {
    id: "the-collector",
    name: "The Collector",
    hint: "Complete a full movie series.",
    earnedHint: "A saga finished end to end.",
    target: 1,
    filter: "series",
    progress: (context) => context.series,
  },
  {
    id: "franchise-killer",
    name: "Franchise Killer",
    hint: "Finish every title in a franchise.",
    earnedHint: "A whole saga marked finished.",
    target: 1,
    openFranchises: true,
    progress: (context) => context.franchises,
  },
  {
    id: "dark-scholar",
    name: "Dark Scholar",
    hint: "Read your first horror book.",
    earnedHint: "A novel survived.",
    target: 1,
    filter: "book",
    progress: (context) => context.books,
  },
  {
    id: "the-record",
    name: "The Record",
    hint: "Finish a documentary.",
    earnedHint: "A true story marked finished.",
    target: 1,
    filter: "documentary",
    progress: (context) => context.documentaries,
  },
  {
    id: "season-finale",
    name: "Season Finale",
    hint: "Finish a TV show.",
    earnedHint: "A show watched through.",
    target: 1,
    filter: "show",
    progress: (context) => context.shows,
  },
  {
    id: "all-nighter",
    name: "All-Nighter",
    hint: "Survive eight hours of finished runtime.",
    earnedHint: "A full night in the vault.",
    target: 8,
    progress: (context) => context.hours,
  },
  {
    id: "first-cut",
    name: "First Cut",
    hint: "Finish a slasher.",
    earnedHint: "A slasher marked finished.",
    target: 1,
    filter: "movie",
    tag: "slasher",
    progress: (context) => context.tag("slasher"),
  },
  {
    id: "grave-raiser",
    name: "Grave Raiser",
    hint: "Finish a zombie title.",
    earnedHint: "The dead walked, and you finished it.",
    target: 1,
    tag: "zombie",
    progress: (context) => context.tag("zombie"),
  },
  {
    id: "nightwalker",
    name: "Nightwalker",
    hint: "Finish a vampire title.",
    earnedHint: "A vampire night survived.",
    target: 1,
    tag: "vampire",
    progress: (context) => context.tag("vampire"),
  },
  {
    id: "the-curator",
    name: "The Curator",
    hint: "Make a list.",
    earnedHint: "A list of your own.",
    target: 1,
    openLists: true,
    progress: (context) => context.lists,
  },
  {
    id: "when-it-happened",
    name: "When It Happened",
    hint: "Set a watch year on a title.",
    earnedHint: "A night dated in the vault.",
    target: 1,
    progress: (context) => context.years,
  },
];

export function buildAchievements(input: AchievementInput): Achievement[] {
  const finished = new Set(input.finishedIds);
  const finishedEntries = input.entries.filter((entry) => finished.has(entry.id));
  const context: AchievementContext = {
    finished,
    entries: input.entries,
    movies: countKind(finishedEntries, "movie"),
    books: countKind(finishedEntries, "book"),
    documentaries: countKind(finishedEntries, "documentary"),
    shows: countKind(finishedEntries, "show"),
    series: completedSeriesCount(input.entries, finished),
    franchises: completedFranchiseCount(input.franchises ?? [], input.entries, finished),
    hours: Math.floor(sumFinishedMinutes(finishedEntries) / 60),
    lists: Math.max(0, input.listCount ?? 0),
    years: Math.max(0, input.yearCount ?? 0),
    tag: (id) => finishedEntries.filter((entry) => keywordsMatchTag(entry.keywords, id)).length,
  };

  return DEFINITIONS.map((definition) => {
    const current = Math.max(0, definition.progress(context));
    const earned = current >= definition.target;
    return {
      id: definition.id,
      name: definition.name,
      hint: earned ? definition.earnedHint : definition.hint,
      earned,
      current: Math.min(current, definition.target),
      target: definition.target,
      ...(definition.filter ? { filter: definition.filter } : {}),
      ...(definition.tag ? { tag: definition.tag } : {}),
      ...(definition.openFranchises ? { openFranchises: true } : {}),
      ...(definition.openLists ? { openLists: true } : {}),
    };
  });
}

function countKind(entries: readonly CatalogEntry[], kind: MediaKind): number {
  return entries.filter((entry) => entry.kind === kind).length;
}

function completedSeriesCount(entries: readonly CatalogEntry[], finished: Set<string>): number {
  let count = 0;
  for (const series of entries.filter((entry) => entry.kind === "series")) {
    if (finished.has(series.id)) {
      count += 1;
      continue;
    }

    const films = entries.filter((entry) => entry.kind === "movie" && entry.seriesId === series.mediaId);
    if (films.length > 0 && films.every((film) => finished.has(film.id))) {
      count += 1;
    }
  }

  return count;
}

function completedFranchiseCount(
  franchises: readonly Franchise[],
  entries: readonly CatalogEntry[],
  finished: Set<string>,
): number {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return franchises.filter((franchise) => {
    const catalog = franchise.items.map((id) => byId.get(id)).filter((entry): entry is CatalogEntry => Boolean(entry));
    return catalog.length > 1 && catalog.every((entry) => finished.has(entry.id));
  }).length;
}

function sumFinishedMinutes(entries: readonly CatalogEntry[]): number {
  return entries.reduce((total, entry) => {
    if (!TIMED_KINDS.has(entry.kind)) {
      return total;
    }

    const minutes = entry.totalTime;
    return total + (typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? minutes : 0);
  }, 0);
}
