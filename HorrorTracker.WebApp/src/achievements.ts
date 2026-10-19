import type { CatalogEntry, MediaKind } from "./catalog";
import type { Franchise } from "./franchises";
import { keywordsMatchTag } from "./tags";

const TIMED_KINDS = new Set<MediaKind>(["movie", "documentary", "show"]);

export interface AchievementCredit {
  id: string;
  title: string;
  detail?: string;
  filter?: MediaKind | "all";
  openFranchises?: boolean;
  openLists?: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  earned: boolean;
  current: number;
  target: number;
  credits: AchievementCredit[];
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
  lists?: readonly { id: number; name: string }[];
  yearCount?: number;
  watchedYears?: Readonly<Record<string, number>>;
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
  namedLists: readonly { id: number; name: string }[];
  years: number;
  watchedYears: Readonly<Record<string, number>>;
  franchisesSource: readonly Franchise[];
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
  credits: (context: AchievementContext) => AchievementCredit[];
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
    credits: (context) => kindCredits(context, "movie"),
  },
  {
    id: "body-count",
    name: "Body Count",
    hint: "Finish 10 movies.",
    earnedHint: "Ten films marked finished.",
    target: 10,
    filter: "movie",
    progress: (context) => context.movies,
    credits: (context) => kindCredits(context, "movie"),
  },
  {
    id: "massacre",
    name: "Massacre",
    hint: "Finish 50 movies.",
    earnedHint: "Fifty films survived.",
    target: 50,
    filter: "movie",
    progress: (context) => context.movies,
    credits: (context) => kindCredits(context, "movie"),
  },
  {
    id: "the-collector",
    name: "The Collector",
    hint: "Complete a full movie series.",
    earnedHint: "A saga finished end to end.",
    target: 1,
    filter: "series",
    progress: (context) => context.series,
    credits: (context) => collectorCredits(context),
  },
  {
    id: "franchise-killer",
    name: "Franchise Killer",
    hint: "Finish every title in a franchise.",
    earnedHint: "A whole saga marked finished.",
    target: 1,
    openFranchises: true,
    progress: (context) => context.franchises,
    credits: (context) => franchiseCredits(context),
  },
  {
    id: "dark-scholar",
    name: "Dark Scholar",
    hint: "Read your first horror book.",
    earnedHint: "A novel survived.",
    target: 1,
    filter: "book",
    progress: (context) => context.books,
    credits: (context) => kindCredits(context, "book"),
  },
  {
    id: "the-record",
    name: "The Record",
    hint: "Finish a documentary.",
    earnedHint: "A true story marked finished.",
    target: 1,
    filter: "documentary",
    progress: (context) => context.documentaries,
    credits: (context) => kindCredits(context, "documentary"),
  },
  {
    id: "season-finale",
    name: "Season Finale",
    hint: "Finish a TV show.",
    earnedHint: "A show watched through.",
    target: 1,
    filter: "show",
    progress: (context) => context.shows,
    credits: (context) => kindCredits(context, "show"),
  },
  {
    id: "all-nighter",
    name: "All-Nighter",
    hint: "Survive eight hours of finished runtime.",
    earnedHint: "A full night in the vault.",
    target: 8,
    progress: (context) => context.hours,
    credits: (context) => runtimeCredits(context),
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
    credits: (context) => tagCredits(context, "slasher"),
  },
  {
    id: "grave-raiser",
    name: "Grave Raiser",
    hint: "Finish a zombie title.",
    earnedHint: "The dead walked, and you finished it.",
    target: 1,
    tag: "zombie",
    progress: (context) => context.tag("zombie"),
    credits: (context) => tagCredits(context, "zombie"),
  },
  {
    id: "nightwalker",
    name: "Nightwalker",
    hint: "Finish a vampire title.",
    earnedHint: "A vampire night survived.",
    target: 1,
    tag: "vampire",
    progress: (context) => context.tag("vampire"),
    credits: (context) => tagCredits(context, "vampire"),
  },
  {
    id: "the-curator",
    name: "The Curator",
    hint: "Make a list.",
    earnedHint: "A list of your own.",
    target: 1,
    openLists: true,
    progress: (context) => context.lists,
    credits: (context) =>
      context.namedLists.map((list) => ({
        id: `list:${list.id}`,
        title: list.name,
        detail: "Your list",
        openLists: true,
      })),
  },
  {
    id: "when-it-happened",
    name: "When It Happened",
    hint: "Set a watch year on a title.",
    earnedHint: "A night dated in the vault.",
    target: 1,
    progress: (context) => context.years,
    credits: (context) => yearCredits(context),
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
    lists: Math.max(0, input.listCount ?? input.lists?.length ?? 0),
    namedLists: input.lists ?? [],
    years: Math.max(0, input.yearCount ?? Object.keys(input.watchedYears ?? {}).length),
    watchedYears: input.watchedYears ?? {},
    franchisesSource: input.franchises ?? [],
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
      credits: sortCredits(definition.credits(context)),
      ...(definition.filter ? { filter: definition.filter } : {}),
      ...(definition.tag ? { tag: definition.tag } : {}),
      ...(definition.openFranchises ? { openFranchises: true } : {}),
      ...(definition.openLists ? { openLists: true } : {}),
    };
  });
}

const KIND_LABEL: Record<MediaKind, string> = {
  movie: "Film",
  series: "Series",
  show: "TV show",
  documentary: "Documentary",
  book: "Book",
  podcast: "Podcast",
  game: "Game",
};

function finishedOf(context: AchievementContext): CatalogEntry[] {
  return context.entries.filter((entry) => context.finished.has(entry.id));
}

function kindCredits(context: AchievementContext, kind: MediaKind): AchievementCredit[] {
  return finishedOf(context)
    .filter((entry) => entry.kind === kind)
    .map((entry) => credit(entry));
}

function tagCredits(context: AchievementContext, tag: string): AchievementCredit[] {
  return finishedOf(context)
    .filter((entry) => keywordsMatchTag(entry.keywords, tag))
    .map((entry) => credit(entry, KIND_LABEL[entry.kind]));
}

function runtimeCredits(context: AchievementContext): AchievementCredit[] {
  return finishedOf(context)
    .filter((entry) => TIMED_KINDS.has(entry.kind) && typeof entry.totalTime === "number" && entry.totalTime > 0)
    .map((entry) => credit(entry, formatMinutes(entry.totalTime ?? 0)));
}

function yearCredits(context: AchievementContext): AchievementCredit[] {
  return context.entries
    .filter((entry) => context.watchedYears[entry.id])
    .map((entry) => credit(entry, String(context.watchedYears[entry.id])));
}

function collectorCredits(context: AchievementContext): AchievementCredit[] {
  const credits: AchievementCredit[] = [];
  for (const series of context.entries.filter((entry) => entry.kind === "series")) {
    const films = context.entries.filter((entry) => entry.kind === "movie" && entry.seriesId === series.mediaId);
    const marked = context.finished.has(series.id);
    const filmsFinished = films.length > 0 && films.every((film) => context.finished.has(film.id));
    if (!marked && !filmsFinished) {
      continue;
    }

    credits.push(credit(series, marked ? "Series marked finished" : `${films.length} films finished`));
    for (const film of films.filter((entry) => context.finished.has(entry.id))) {
      credits.push(credit(film, series.title));
    }
  }

  return credits;
}

function franchiseCredits(context: AchievementContext): AchievementCredit[] {
  const byId = new Map(context.entries.map((entry) => [entry.id, entry]));
  const credits: AchievementCredit[] = [];
  for (const franchise of context.franchisesSource) {
    const catalog = franchise.items.map((id) => byId.get(id)).filter((entry): entry is CatalogEntry => Boolean(entry));
    if (catalog.length < 2 || !catalog.every((entry) => context.finished.has(entry.id))) {
      continue;
    }

    credits.push({
      id: `franchise:${franchise.id}`,
      title: franchise.name,
      detail: "Every title finished",
      openFranchises: true,
    });
    for (const entry of catalog) {
      credits.push(credit(entry, franchise.name));
    }
  }

  return credits;
}

function credit(entry: CatalogEntry, detail?: string): AchievementCredit {
  return {
    id: entry.id,
    title: entry.title,
    filter: entry.kind,
    ...(detail ? { detail } : { detail: KIND_LABEL[entry.kind] }),
  };
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 1) {
    return `${minutes} min`;
  }

  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function sortCredits(credits: AchievementCredit[]): AchievementCredit[] {
  return [...credits].sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
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
