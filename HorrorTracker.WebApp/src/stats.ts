import { formatRuntime, type CatalogEntry, type MediaKind } from "./catalog";

const TIMED_KINDS = new Set<MediaKind>(["movie", "documentary", "show"]);

export interface FunStat {
  value: string;
  label: string;
  hint: string;
  filter?: MediaKind | "all";
  query?: string;
}

export interface StatGroup {
  time: FunStat[];
  extras: FunStat[];
  kinds: FunStat[];
}

export interface HorrorStats {
  yours?: StatGroup;
  vault: StatGroup;
}

export function buildHorrorStats(entries: CatalogEntry[], finishedIds: readonly string[], signedIn: boolean): HorrorStats {
  const finished = new Set(finishedIds);
  const timed = entries.filter((entry) => isTimed(entry));
  const movies = entries.filter((entry) => entry.kind === "movie");
  const documentaries = entries.filter((entry) => entry.kind === "documentary");
  const shows = entries.filter((entry) => entry.kind === "show");
  const dated = entries.filter((entry) => (entry.releaseYear ?? 0) > 0);
  const vaultMinutes = sumMinutes(timed);
  const averageMovie = averageMinutes(movies.filter((entry) => minutesOf(entry) > 0));
  const longestVault = pickLongest(movies.filter((entry) => minutesOf(entry) > 0));
  const oldestVault = pickOldest(dated);
  const biggestSeries = pickBiggestSeries(entries);
  const vaultDecade = pickDecade(dated);

  const vault: StatGroup = {
    time: [
      {
        value: formatHours(vaultMinutes),
        label: "In the vault",
        hint: "Movies, documentaries, and shows — series time is already in the films.",
      },
      {
        value: formatHours(averageMovie),
        label: "Average film",
        hint: averageMovie > 0 ? "Mean runtime of movies with a listed length." : "Movie runtimes appear as titles are added.",
        filter: "movie",
      },
      nightsStat(vaultMinutes, "Nights in the vault", "If you sat through the whole catalog, eight hours at a time."),
    ],
    extras: [],
    kinds: kindStats(documentaries, shows),
  };

  if (longestVault) {
    vault.extras.push({
      value: longestVault.title,
      label: "Longest film",
      hint: formatRuntime(minutesOf(longestVault)) ?? "Runtime unknown",
      filter: longestVault.kind,
      query: longestVault.title,
    });
  }

  if (oldestVault?.releaseYear) {
    vault.extras.push({
      value: String(oldestVault.releaseYear),
      label: "Oldest title",
      hint: oldestVault.title,
      filter: oldestVault.kind,
      query: oldestVault.title,
    });
  }

  if (biggestSeries) {
    vault.extras.push({
      value: String(biggestSeries.count),
      label: "Biggest series",
      hint: `${biggestSeries.title} · ${biggestSeries.count === 1 ? "1 film" : `${biggestSeries.count} films`}`,
      filter: "series",
      query: biggestSeries.title,
    });
  }

  if (vaultDecade) {
    vault.extras.push({
      value: `${vaultDecade.year}s`,
      label: "Busiest decade",
      hint: `${vaultDecade.count === 1 ? "1 title" : `${vaultDecade.count} titles`} from ${vaultDecade.year}–${vaultDecade.year + 9}.`,
      filter: "all",
      query: String(vaultDecade.year).slice(0, 3),
    });
  }

  if (!signedIn) {
    return { vault };
  }

  const finishedTimed = timed.filter((entry) => finished.has(entry.id));
  const waitingTimed = timed.filter((entry) => !finished.has(entry.id));
  const finishedMinutes = sumMinutes(finishedTimed);
  const waitingMinutes = sumMinutes(waitingTimed);
  const finishedMovies = movies.filter((entry) => finished.has(entry.id) && minutesOf(entry) > 0);
  const finishedDated = dated.filter((entry) => finished.has(entry.id));
  const longestYours = pickLongest(finishedMovies);
  const oldestYours = pickOldest(finishedDated);
  const yourDecade = pickDecade(finishedDated);

  const yours: StatGroup = {
    time: [
      {
        value: formatHours(finishedMinutes),
        label: "Hours survived",
        hint: finishedMinutes > 0 ? "Runtime you've marked finished." : "Tap titles in the library to start the clock.",
      },
      {
        value: formatHours(waitingMinutes),
        label: "Still in the dark",
        hint: waitingMinutes > 0 ? "Unwatched runtime left in the vault." : "Nothing timed is left unmarked.",
      },
    ],
    extras: [],
    kinds: personalKindStats(documentaries, shows, finished),
  };

  if (longestYours) {
    yours.extras.push({
      value: longestYours.title,
      label: "Your longest night",
      hint: formatRuntime(minutesOf(longestYours)) ?? "Runtime unknown",
      filter: longestYours.kind,
      query: longestYours.title,
    });
  }

  if (oldestYours?.releaseYear) {
    yours.extras.push({
      value: String(oldestYours.releaseYear),
      label: "Oldest you've survived",
      hint: oldestYours.title,
      filter: oldestYours.kind,
      query: oldestYours.title,
    });
  }

  if (yourDecade) {
    yours.extras.push({
      value: `${yourDecade.year}s`,
      label: "Your decade",
      hint: `${yourDecade.count === 1 ? "1 title" : `${yourDecade.count} titles`} from ${yourDecade.year}–${yourDecade.year + 9}.`,
      filter: "all",
      query: String(yourDecade.year).slice(0, 3),
    });
  }

  if (finishedMinutes >= 60) {
    yours.extras.push(nightsStat(finishedMinutes, "All-nighters survived", "Finished runtime, counted as eight-hour nights."));
  }

  return { yours, vault };
}

function kindStats(documentaries: CatalogEntry[], shows: CatalogEntry[]): FunStat[] {
  const stats: FunStat[] = [];
  if (documentaries.length > 0) {
    const minutes = sumMinutes(documentaries);
    stats.push({
      value: formatHours(minutes),
      label: "Documentary hours",
      hint: documentaries.length === 1 ? "1 true story in the vault." : `${documentaries.length} true stories in the vault.`,
      filter: "documentary",
    });
    const longest = pickLongest(documentaries.filter((entry) => minutesOf(entry) > 0));
    if (longest) {
      stats.push({
        value: longest.title,
        label: "Longest documentary",
        hint: formatRuntime(minutesOf(longest)) ?? "Runtime unknown",
        filter: "documentary",
        query: longest.title,
      });
    }
  }

  if (shows.length > 0) {
    const minutes = sumMinutes(shows);
    const episodes = shows.reduce((total, show) => total + (show.totalEpisodes ?? 0), 0);
    stats.push({
      value: minutes > 0 ? formatHours(minutes) : episodes > 0 ? String(episodes) : String(shows.length),
      label: minutes > 0 ? "Show hours" : episodes > 0 ? "Episodes in the vault" : "TV shows",
      hint:
        shows.length === 1
          ? minutes > 0
            ? "1 TV show in the vault."
            : "Episode count for the show in the vault."
          : minutes > 0
            ? `${shows.length} TV shows in the vault.`
            : `${shows.length} TV shows · ${episodes} episodes.`,
      filter: "show",
    });
    const biggest = pickMostEpisodes(shows) ?? pickLongest(shows.filter((entry) => minutesOf(entry) > 0));
    if (biggest) {
      stats.push({
        value: biggest.title,
        label: biggest.totalEpisodes ? "Most episodes" : "Longest show",
        hint: showSizeHint(biggest),
        filter: "show",
        query: biggest.title,
      });
    }
  }

  return stats;
}

function personalKindStats(documentaries: CatalogEntry[], shows: CatalogEntry[], finished: Set<string>): FunStat[] {
  const stats: FunStat[] = [];
  if (documentaries.length > 0) {
    const done = documentaries.filter((entry) => finished.has(entry.id));
    stats.push({
      value: `${done.length} of ${documentaries.length}`,
      label: "Documentaries survived",
      hint: done.length > 0 ? `${formatHours(sumMinutes(done))} marked finished.` : "Tap a documentary to start this count.",
      filter: "documentary",
    });
    const longest = pickLongest(done.filter((entry) => minutesOf(entry) > 0));
    if (longest) {
      stats.push({
        value: longest.title,
        label: "Your longest documentary",
        hint: formatRuntime(minutesOf(longest)) ?? "Runtime unknown",
        filter: "documentary",
        query: longest.title,
      });
    }
  }

  if (shows.length > 0) {
    const done = shows.filter((entry) => finished.has(entry.id));
    stats.push({
      value: `${done.length} of ${shows.length}`,
      label: "Shows survived",
      hint: done.length > 0 ? `${formatHours(sumMinutes(done))} marked finished.` : "Mark episodes or a show to count it here.",
      filter: "show",
    });
    const longest = pickMostEpisodes(done) ?? pickLongest(done.filter((entry) => minutesOf(entry) > 0));
    if (longest) {
      stats.push({
        value: longest.title,
        label: "A show you finished",
        hint: showSizeHint(longest),
        filter: "show",
        query: longest.title,
      });
    }
  }

  return stats;
}

function pickMostEpisodes(shows: CatalogEntry[]): CatalogEntry | undefined {
  return [...shows]
    .filter((entry) => (entry.totalEpisodes ?? 0) > 0)
    .sort(
      (left, right) =>
        (right.totalEpisodes ?? 0) - (left.totalEpisodes ?? 0) ||
        (right.numberOfSeasons ?? 0) - (left.numberOfSeasons ?? 0) ||
        left.title.localeCompare(right.title),
    )[0];
}

function showSizeHint(show: CatalogEntry): string {
  const parts: string[] = [];
  if (show.numberOfSeasons) {
    parts.push(show.numberOfSeasons === 1 ? "1 season" : `${show.numberOfSeasons} seasons`);
  }

  if (show.totalEpisodes) {
    parts.push(show.totalEpisodes === 1 ? "1 episode" : `${show.totalEpisodes} episodes`);
  }

  const runtime = formatRuntime(minutesOf(show));
  if (runtime) {
    parts.push(runtime);
  }

  return parts.join(" · ") || "No episode count yet.";
}

function nightsStat(minutes: number, label: string, hint: string): FunStat {
  const nights = minutes >= 60 ? Math.max(1, Math.round(minutes / 480)) : 0;
  return {
    value: String(nights),
    label,
    hint,
  };
}

function isTimed(entry: CatalogEntry): boolean {
  return TIMED_KINDS.has(entry.kind) && minutesOf(entry) > 0;
}

function minutesOf(entry: CatalogEntry): number {
  const minutes = entry.totalTime;
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function sumMinutes(entries: CatalogEntry[]): number {
  return entries.reduce((total, entry) => total + minutesOf(entry), 0);
}

function averageMinutes(entries: CatalogEntry[]): number {
  if (entries.length < 1) {
    return 0;
  }

  return sumMinutes(entries) / entries.length;
}

function pickLongest(entries: CatalogEntry[]): CatalogEntry | undefined {
  return [...entries].sort((left, right) => minutesOf(right) - minutesOf(left) || left.title.localeCompare(right.title))[0];
}

function pickOldest(entries: CatalogEntry[]): CatalogEntry | undefined {
  return [...entries].sort(
    (left, right) => (left.releaseYear ?? 0) - (right.releaseYear ?? 0) || left.title.localeCompare(right.title),
  )[0];
}

function pickBiggestSeries(entries: CatalogEntry[]): { title: string; count: number } | undefined {
  const seriesTitles = new Map<number, string>();
  for (const entry of entries) {
    if (entry.kind === "series") {
      seriesTitles.set(entry.mediaId, entry.title);
    }
  }

  const counts = new Map<number, number>();
  for (const entry of entries) {
    if (entry.kind !== "movie" || !(entry.seriesId && entry.seriesId > 0)) {
      continue;
    }

    counts.set(entry.seriesId, (counts.get(entry.seriesId) ?? 0) + 1);
  }

  let best: { title: string; count: number } | undefined;
  for (const [seriesId, count] of counts) {
    const title = seriesTitles.get(seriesId);
    if (!title || count < 1) {
      continue;
    }

    if (!best || count > best.count || (count === best.count && title.localeCompare(best.title) < 0)) {
      best = { title, count };
    }
  }

  return best;
}

function pickDecade(entries: CatalogEntry[]): { year: number; count: number } | undefined {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    const year = entry.releaseYear;
    if (!year || year < 1888) {
      continue;
    }

    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }

  let best: { year: number; count: number } | undefined;
  for (const [year, count] of counts) {
    if (!best || count > best.count || (count === best.count && year > best.year)) {
      best = { year, count };
    }
  }

  return best;
}

function formatHours(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes);
  if (minutes < 1) {
    return "0 hr";
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (days > 0) {
    parts.push(days === 1 ? "1 day" : `${days} days`);
  }

  if (hours > 0) {
    parts.push(hours === 1 ? "1 hr" : `${hours} hr`);
  }

  if (rest > 0 && days < 1) {
    parts.push(`${rest} min`);
  }

  return parts.join(" ") || "0 hr";
}
