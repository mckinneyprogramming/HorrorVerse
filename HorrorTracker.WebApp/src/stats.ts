import { formatRuntime, type CatalogEntry, type MediaKind } from "./catalog";

const TIMED_KINDS = new Set<MediaKind>(["movie", "documentary", "show"]);
const FEATURE_KINDS = new Set<MediaKind>(["movie", "documentary"]);

export interface FunStat {
  value: string;
  label: string;
  hint: string;
  filter?: MediaKind | "all";
  query?: string;
}

export interface HorrorStats {
  time: FunStat[];
  extras: FunStat[];
}

export function buildHorrorStats(
  entries: CatalogEntry[],
  finishedIds: readonly string[],
  signedIn: boolean,
): HorrorStats {
  const finished = new Set(finishedIds);
  const timed = entries.filter((entry) => isTimed(entry));
  const features = entries.filter((entry) => FEATURE_KINDS.has(entry.kind) && minutesOf(entry) > 0);
  const dated = entries.filter((entry) => (entry.releaseYear ?? 0) > 0);
  const vaultMinutes = sumMinutes(timed);
  const finishedTimed = signedIn ? timed.filter((entry) => finished.has(entry.id)) : [];
  const waitingTimed = signedIn ? timed.filter((entry) => !finished.has(entry.id)) : [];
  const finishedMinutes = sumMinutes(finishedTimed);
  const waitingMinutes = sumMinutes(waitingTimed);
  const longestVault = pickLongest(features);
  const oldestVault = pickOldest(dated);
  const biggestSeries = pickBiggestSeries(entries);
  const vaultDecade = pickDecade(dated);
  const finishedFeatures = signedIn ? features.filter((entry) => finished.has(entry.id)) : [];
  const finishedDated = signedIn ? dated.filter((entry) => finished.has(entry.id)) : [];
  const longestYours = pickLongest(finishedFeatures);
  const oldestYours = pickOldest(finishedDated);
  const yourDecade = pickDecade(finishedDated);
  const averageMovie = averageMinutes(entries.filter((entry) => entry.kind === "movie" && minutesOf(entry) > 0));

  const time: FunStat[] = [
    {
      value: formatHours(vaultMinutes),
      label: "In the vault",
      hint: "Movies, documentaries, and shows — series time is already in the films.",
    },
  ];

  if (signedIn) {
    time.push(
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
    );
  } else {
    time.push(
      {
        value: formatHours(averageMovie),
        label: "Average film",
        hint: averageMovie > 0 ? "Mean runtime of movies with a listed length." : "Movie runtimes appear as titles are added.",
        filter: "movie",
      },
      nightsStat(vaultMinutes, "Nights in the vault", "If you sat through the whole catalog, eight hours at a time."),
    );
  }

  const extras: FunStat[] = [];
  const longest = longestYours ?? longestVault;
  if (longest) {
    extras.push({
      value: longest.title,
      label: longestYours ? "Your longest night" : "Longest film",
      hint: formatRuntime(minutesOf(longest)) ?? "Runtime unknown",
      filter: longest.kind,
      query: longest.title,
    });
  }

  const oldest = oldestYours ?? oldestVault;
  if (oldest?.releaseYear) {
    extras.push({
      value: String(oldest.releaseYear),
      label: oldestYours ? "Oldest you've survived" : "Oldest title",
      hint: oldest.title,
      filter: oldest.kind,
      query: oldest.title,
    });
  }

  if (biggestSeries) {
    extras.push({
      value: String(biggestSeries.count),
      label: "Biggest series",
      hint: `${biggestSeries.title} · ${biggestSeries.count === 1 ? "1 film" : `${biggestSeries.count} films`}`,
      filter: "series",
      query: biggestSeries.title,
    });
  }

  const decade = yourDecade ?? vaultDecade;
  if (decade) {
    extras.push({
      value: `${decade.year}s`,
      label: yourDecade ? "Your decade" : "Busiest decade",
      hint: `${decade.count === 1 ? "1 title" : `${decade.count} titles`} from ${decade.year}–${decade.year + 9}.`,
      filter: "all",
      query: String(decade.year).slice(0, 3),
    });
  }

  if (signedIn && finishedMinutes >= 60) {
    extras.push(nightsStat(finishedMinutes, "All-nighters survived", "Finished runtime, counted as eight-hour nights."));
  }

  return { time, extras };
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
