import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./catalog";
import { buildHorrorStats } from "./stats";

const scream: CatalogEntry = {
  id: "movie:1",
  mediaId: 1,
  title: "Scream",
  kind: "movie",
  completed: false,
  totalTime: 111,
  releaseYear: 1996,
};

const aliens: CatalogEntry = {
  id: "movie:2",
  mediaId: 2,
  title: "Aliens",
  kind: "movie",
  completed: false,
  totalTime: 137,
  releaseYear: 1986,
  seriesId: 10,
};

const alienSeries: CatalogEntry = {
  id: "series:10",
  mediaId: 10,
  title: "Alien",
  kind: "series",
  completed: false,
};

function stat(group: { extras: { label: string; value: string }[]; time: { label: string; value: string }[] }, label: string) {
  return [...group.time, ...group.extras].find((item) => item.label === label);
}

describe("buildHorrorStats", () => {
  const entries = [scream, aliens, alienSeries];

  it("returns vault stats without a signed-in group", () => {
    const stats = buildHorrorStats(entries, [], false);

    expect(stats.yours).toBeUndefined();
    expect(stat(stats.vault, "Longest film")?.value).toBe("Aliens");
    expect(stat(stats.vault, "Oldest title")?.value).toBe("1986");
    expect(stat(stats.vault, "Biggest series")?.value).toBe("1");
    expect(stat(stats.vault, "Biggest series")?.hint).toContain("Alien");
  });

  it("counts only finished runtimes in the personal group", () => {
    const stats = buildHorrorStats(entries, ["movie:1"], true);

    expect(stats.yours).toBeDefined();
    expect(stat(stats.yours!, "Hours survived")?.value).toBe("1 hr 51 min");
    expect(stat(stats.yours!, "Your longest night")?.value).toBe("Scream");
    expect(stat(stats.yours!, "Oldest you've survived")?.value).toBe("1996");
  });

  it("counts pages in the vault and pages marked read", () => {
    const book: CatalogEntry = { id: "book:1", mediaId: 1, title: "It", kind: "book", completed: false, pages: 1138 };
    const unread: CatalogEntry = { id: "book:2", mediaId: 2, title: "Carrie", kind: "book", completed: false, pages: 199 };
    const stats = buildHorrorStats([book, unread], ["book:1"], true);

    expect(stat(stats.vault, "Pages in the vault")?.value).toBe("1,337");
    expect(stat(stats.yours!, "Pages read")?.value).toBe("1,138");
  });

  it("handles an empty vault", () => {
    const stats = buildHorrorStats([], [], true);

    expect(stat(stats.vault, "In the vault")?.value).toBe("0 hr");
    expect(stat(stats.yours!, "Hours survived")?.value).toBe("0 hr");
    expect(stats.vault.extras).toEqual([]);
  });
});

function row(partial: Partial<CatalogEntry> & Pick<CatalogEntry, "id" | "title" | "kind">): CatalogEntry {
  return { mediaId: 1, completed: false, ...partial };
}

function findStat(
  group: { time: { label: string; value: string; hint: string }[]; extras: { label: string; value: string; hint: string }[]; kinds: { label: string; value: string; hint: string }[] } | undefined,
  label: string,
) {
  if (!group) {
    return undefined;
  }

  return [...group.time, ...group.extras, ...group.kinds].find((item) => item.label === label);
}

describe("vault time formatting", () => {
  it.each([
    [45, "45 min"],
    [60, "1 hr"],
    [90, "1 hr 30 min"],
    [120, "2 hr"],
    [1440, "1 day"],
    [1470, "1 day"],
    [1500, "1 day 1 hr"],
    [2880, "2 days"],
    [3000, "2 days 2 hr"],
    [0.4, "0 hr"],
  ])("sums %s minutes as %s", (minutes, expected) => {
    const stats = buildHorrorStats([row({ id: "movie:1", title: "Night", kind: "movie", totalTime: minutes, releaseYear: 1990 })], [], false);
    expect(stat(stats.vault, "In the vault")?.value).toBe(expected);
  });

  it("describes an average only after a film has a runtime", () => {
    const quiet = buildHorrorStats([row({ id: "book:1", title: "It", kind: "book", pages: 0 })], [], false);
    expect(stat(quiet.vault, "Average film")?.hint).toBe("Movie runtimes appear as titles are added.");
    expect(findStat(quiet.vault, "Pages in the vault")).toBeUndefined();

    const negative = buildHorrorStats([row({ id: "book:2", title: "Carrie", kind: "book", pages: -3 })], [], true, []);
    expect(findStat(negative.vault, "Pages in the vault")).toBeUndefined();
    expect(findStat(negative.yours, "Pages read")).toBeUndefined();

    const unread = buildHorrorStats([row({ id: "book:3", title: "Misery", kind: "book", pages: 10 })], [], true);
    expect(findStat(unread.vault, "Pages in the vault")?.value).toBe("10");
    expect(findStat(unread.yours, "Pages read")).toBeUndefined();
  });

  it("uses runtime unknown when a length rounds away", () => {
    const film = row({ id: "movie:1", title: "Blink", kind: "movie", totalTime: 0.4, releaseYear: 1999 });
    const vault = buildHorrorStats([film], [], false);
    expect(findStat(vault.vault, "Longest film")?.hint).toBe("Runtime unknown");
    const yours = buildHorrorStats([film], ["movie:1"], true);
    expect(findStat(yours.yours, "Your longest night")?.hint).toBe("Runtime unknown");
    expect(findStat(yours.yours, "All-nighters survived")).toBeUndefined();
  });
});

describe("shows, documentaries, and series", () => {
  it("counts one timed show and one documentary", () => {
    const stats = buildHorrorStats(
      [
        row({ id: "documentary:1", title: "Cropsey", kind: "documentary", totalTime: 60, releaseYear: 2009 }),
        row({ id: "show:1", title: "Zone", kind: "show", totalTime: 60, totalEpisodes: 1, numberOfSeasons: 1 }),
        row({ id: "series:1", mediaId: 1, title: "Alien", kind: "series" }),
        row({ id: "movie:1", title: "Alien", kind: "movie", totalTime: 100, seriesId: 1, releaseYear: 1979 }),
        row({ id: "movie:2", title: "Aliens", kind: "movie", totalTime: 120, seriesId: 1, releaseYear: 1986 }),
      ],
      [],
      false,
    );
    expect(findStat(stats.vault, "Documentary hours")?.hint).toBe("1 true story in the vault.");
    expect(findStat(stats.vault, "Longest documentary")?.value).toBe("Cropsey");
    expect(findStat(stats.vault, "Show hours")?.hint).toBe("1 TV show in the vault.");
    expect(findStat(stats.vault, "Most episodes")?.hint).toBe("1 season · 1 episode · 1 hr");
    expect(findStat(stats.vault, "Biggest series")?.hint).toBe("Alien · 2 films");
  });

  it("counts several documentaries and episode-only shows", () => {
    const stats = buildHorrorStats(
      [
        row({ id: "documentary:1", title: "A", kind: "documentary" }),
        row({ id: "documentary:2", title: "B", kind: "documentary", totalTime: 30 }),
        row({ id: "show:1", title: "Zed", kind: "show", totalEpisodes: 10, numberOfSeasons: 1 }),
        row({ id: "show:2", title: "Alpha", kind: "show", totalEpisodes: 10, numberOfSeasons: 1 }),
        row({ id: "show:3", title: "Beta", kind: "show", totalEpisodes: 10, numberOfSeasons: 3 }),
        row({ id: "show:4", title: "Gamma", kind: "show", totalEpisodes: 12, numberOfSeasons: 2 }),
      ],
      [],
      false,
    );
    expect(findStat(stats.vault, "Documentary hours")?.hint).toBe("2 true stories in the vault.");
    expect(findStat(stats.vault, "Episodes in the vault")?.value).toBe("42");
    expect(findStat(stats.vault, "Episodes in the vault")?.hint).toBe("4 TV shows · 42 episodes.");
    expect(findStat(stats.vault, "Most episodes")?.value).toBe("Gamma");

    const faint = buildHorrorStats([row({ id: "documentary:1", title: "Blink", kind: "documentary", totalTime: 0.4 })], [], false);
    expect(findStat(faint.vault, "Longest documentary")?.hint).toBe("Runtime unknown");

    const unseasoned = buildHorrorStats(
      [
        row({ id: "show:1", title: "Zed", kind: "show", totalEpisodes: 4 }),
        row({ id: "show:2", title: "Alpha", kind: "show", totalEpisodes: 4 }),
      ],
      [],
      false,
    );
    expect(findStat(unseasoned.vault, "Most episodes")?.value).toBe("Alpha");
  });

  it("labels a show by episodes, by count, or by runtime", () => {
    const oneEpisode = buildHorrorStats([row({ id: "show:1", title: "Pilot", kind: "show", totalEpisodes: 8 })], [], false);
    expect(findStat(oneEpisode.vault, "Episodes in the vault")?.hint).toBe("Episode count for the show in the vault.");
    expect(findStat(oneEpisode.vault, "Most episodes")?.hint).toBe("8 episodes");

    const bare = buildHorrorStats([row({ id: "show:1", title: "Bare", kind: "show" })], [], false);
    expect(findStat(bare.vault, "TV shows")?.value).toBe("1");
    expect(findStat(bare.vault, "Most episodes")).toBeUndefined();

    const counted = buildHorrorStats(
      [row({ id: "show:1", title: "A", kind: "show" }), row({ id: "show:2", title: "B", kind: "show" })],
      [],
      false,
    );
    expect(findStat(counted.vault, "TV shows")?.hint).toBe("2 TV shows · 0 episodes.");

    const timed = buildHorrorStats(
      [
        row({ id: "show:1", title: "Longer", kind: "show", totalTime: 120 }),
        row({ id: "show:2", title: "Shorter", kind: "show", totalTime: 60 }),
      ],
      [],
      false,
    );
    expect(findStat(timed.vault, "Show hours")?.hint).toBe("2 TV shows in the vault.");
    expect(findStat(timed.vault, "Longest show")?.value).toBe("Longer");
    expect(findStat(timed.vault, "Longest show")?.hint).toBe("2 hr");

    const tiny = buildHorrorStats([row({ id: "show:1", title: "Blink", kind: "show", totalTime: 0.4 })], [], false);
    expect(findStat(tiny.vault, "Longest show")?.hint).toBe("No episode count yet.");

    const singular = buildHorrorStats(
      [row({ id: "show:1", title: "Once", kind: "show", totalEpisodes: 1, numberOfSeasons: 1, totalTime: 60 })],
      [],
      false,
    );
    expect(findStat(singular.vault, "Most episodes")?.hint).toBe("1 season · 1 episode · 1 hr");
  });

  it("breaks ties for longest films, oldest years, series, and decades", () => {
    const tiedRuntime = buildHorrorStats(
      [
        row({ id: "movie:1", title: "Zed", kind: "movie", totalTime: 80, releaseYear: 1800 }),
        row({ id: "movie:2", title: "Alpha", kind: "movie", totalTime: 80, releaseYear: 1800 }),
      ],
      [],
      false,
    );
    expect(findStat(tiedRuntime.vault, "Longest film")?.value).toBe("Alpha");
    expect(findStat(tiedRuntime.vault, "Oldest title")?.hint).toBe("Alpha");

    const longer = buildHorrorStats(
      [
        row({ id: "movie:1", title: "Short", kind: "movie", totalTime: 50, releaseYear: 1990 }),
        row({ id: "movie:2", title: "Long", kind: "movie", totalTime: 80, releaseYear: 2001 }),
      ],
      [],
      false,
    );
    expect(findStat(longer.vault, "Longest film")?.value).toBe("Long");

    const entries: CatalogEntry[] = [
      row({ id: "series:1", mediaId: 1, title: "Blade", kind: "series" }),
      row({ id: "series:2", mediaId: 2, title: "Alien", kind: "series" }),
      row({ id: "series:3", mediaId: 3, title: "Zed", kind: "series" }),
      row({ id: "series:4", mediaId: 4, title: "Apex", kind: "series" }),
      row({ id: "series:5", mediaId: 5, title: "Zulu", kind: "series" }),
      row({ id: "movie:1", title: "One", kind: "movie", totalTime: 10, seriesId: 1, releaseYear: 1991 }),
      row({ id: "movie:2", title: "Two", kind: "movie", totalTime: 10, seriesId: 2, releaseYear: 1982 }),
      row({ id: "movie:3", title: "Three", kind: "movie", totalTime: 10, seriesId: 3, releaseYear: 1999 }),
      row({ id: "movie:4", title: "Four", kind: "movie", totalTime: 10, seriesId: 3, releaseYear: 1989 }),
      row({ id: "movie:5", title: "Five", kind: "movie", totalTime: 10, seriesId: 1, releaseYear: 2001 }),
      row({ id: "movie:6", title: "Six", kind: "movie", totalTime: Number.NaN, seriesId: 99, releaseYear: 2008 }),
      row({ id: "movie:7", title: "Seven", kind: "movie", totalTime: 0, seriesId: 0, releaseYear: 1800 }),
      row({ id: "movie:8", title: "Eight", kind: "movie", totalTime: "x" as unknown as number, seriesId: -5, releaseYear: 2010 }),
      row({ id: "movie:9", title: "Nine", kind: "movie", totalTime: -4, releaseYear: 2015 }),
      row({ id: "movie:10", title: "Ten", kind: "movie", totalTime: Number.POSITIVE_INFINITY, seriesId: 4, releaseYear: 1975 }),
      row({ id: "movie:11", title: "Eleven", kind: "movie", totalTime: 10, seriesId: 4 }),
      row({ id: "movie:12", title: "Twelve", kind: "movie", totalTime: 10, seriesId: 5, releaseYear: 1887 }),
      row({ id: "movie:13", title: "Thirteen", kind: "movie", totalTime: 10, seriesId: 5, releaseYear: 1888 }),
      row({ id: "podcast:1", title: "Lore", kind: "podcast" }),
    ];
    const stats = buildHorrorStats(entries, [], false);
    expect(findStat(stats.vault, "Biggest series")?.value).toBe("2");
    expect(findStat(stats.vault, "Biggest series")?.hint).toContain("Apex");
    expect(findStat(stats.vault, "Busiest decade")?.hint).toBe("2 titles from 2010–2019.");
    expect(findStat(stats.vault, "Oldest title")?.value).toBe("1800");
  });
});

describe("personal and franchise stats", () => {
  const m1 = row({ id: "movie:1", title: "Alpha", kind: "movie", totalTime: 90, releaseYear: 1980 });
  const m2 = row({ id: "movie:2", title: "Beta", kind: "movie", totalTime: 40, releaseYear: 1990 });
  const m3 = row({ id: "movie:3", title: "Gamma", kind: "movie", totalTime: 70, releaseYear: 1992 });
  const m4 = row({ id: "movie:4", title: "Delta", kind: "movie", totalTime: 20, releaseYear: 2000 });

  it("picks the biggest franchise through ties and skips empty groups", () => {
    const stats = buildHorrorStats([m1, m2, m3, m4], [], false, [
      { id: 1, name: "Empty", items: ["missing"] },
      { id: 2, name: "Zed", items: ["movie:1"] },
      { id: 3, name: "Alpha", items: ["movie:2"] },
      { id: 4, name: "Mu", items: ["movie:3"] },
      { id: 5, name: "Big", items: ["movie:1", "movie:2"] },
      { id: 6, name: "Small", items: ["movie:4", "missing"] },
      { id: 7, name: "Apex", items: ["movie:1", "movie:3"] },
      { id: 8, name: "Zulu", items: ["movie:2", "movie:4"] },
    ]);
    expect(findStat(stats.vault, "Franchises")?.hint).toBe("8 shared sagas in the vault.");
    expect(findStat(stats.vault, "Biggest franchise")?.value).toBe("Apex");
    expect(findStat(stats.vault, "Biggest franchise")?.hint).toBe("2 titles grouped together.");

    const single = buildHorrorStats([m1], [], false, [{ id: 1, name: "Only", items: ["movie:1"] }]);
    expect(findStat(single.vault, "Franchises")?.hint).toBe("1 shared saga in the vault.");
    expect(findStat(single.vault, "Biggest franchise")?.hint).toBe("1 title grouped together.");
  });

  it("counts finished and waiting time, including a cleared vault", () => {
    const waiting = buildHorrorStats([m1], [], true);
    expect(findStat(waiting.yours, "Hours survived")?.hint).toBe("Tap titles in the library to start the clock.");
    expect(findStat(waiting.yours, "Still in the dark")?.hint).toBe("Unwatched runtime left in the vault.");
    expect(findStat(waiting.yours, "All-nighters survived")).toBeUndefined();

    const cleared = buildHorrorStats([m1], ["movie:1"], true);
    expect(findStat(cleared.yours, "Still in the dark")?.hint).toBe("Nothing timed is left unmarked.");
    expect(findStat(cleared.yours, "All-nighters survived")?.value).toBe("1");
    expect(findStat(cleared.yours, "Your decade")?.hint).toBe("1 title from 1980–1989.");
  });

  it("counts personal documentaries, shows, and decades", () => {
    const docs = [
      row({ id: "documentary:1", title: "Cropsey", kind: "documentary", totalTime: 0.4 }),
      row({ id: "documentary:2", title: "Other", kind: "documentary", totalTime: 60 }),
    ];
    const untouched = buildHorrorStats(docs, [], true);
    expect(findStat(untouched.yours, "Documentaries survived")?.hint).toBe("Tap a documentary to start this count.");

    const watched = buildHorrorStats(docs, ["documentary:1"], true);
    expect(findStat(watched.yours, "Documentaries survived")?.hint).toBe("0 hr marked finished.");
    expect(findStat(watched.yours, "Your longest documentary")?.hint).toBe("Runtime unknown");

    const shows = [
      row({ id: "show:1", title: "Zone", kind: "show", totalEpisodes: 4, numberOfSeasons: 1, totalTime: 80 }),
      row({ id: "show:2", title: "Bare", kind: "show" }),
    ];
    const none = buildHorrorStats(shows, [], true);
    expect(findStat(none.yours, "Shows survived")?.hint).toBe("Mark episodes or a show to count it here.");
    const one = buildHorrorStats(shows, ["show:1"], true);
    expect(findStat(one.yours, "A show you finished")?.value).toBe("Zone");
    const runtimeOnly = buildHorrorStats([row({ id: "show:3", title: "Hours", kind: "show", totalTime: 60 })], ["show:3"], true);
    expect(findStat(runtimeOnly.yours, "A show you finished")?.hint).toBe("1 hr");

    const dated = [
      row({ id: "movie:1", title: "Old", kind: "movie", totalTime: 60, releaseYear: 1978 }),
      row({ id: "movie:2", title: "Also", kind: "movie", totalTime: 60, releaseYear: 1979 }),
      row({ id: "movie:3", title: "Newer", kind: "movie", totalTime: 60, releaseYear: 1994 }),
      row({ id: "movie:4", title: "Newest", kind: "movie", totalTime: 60, releaseYear: 1996 }),
    ];
    const decade = buildHorrorStats(dated, ["movie:1", "movie:2", "movie:3", "movie:4"], true);
    expect(findStat(decade.yours, "Your decade")?.hint).toBe("2 titles from 1990–1999.");
  });

  it("counts franchises a member has started or finished", () => {
    const entries = [m1, m2, m3];
    const none = buildHorrorStats(entries, [], true, [
      { id: 1, name: "Alien", items: ["movie:1", "movie:2"] },
      { id: 2, name: "Saw", items: ["movie:3"] },
    ]);
    expect(findStat(none.yours, "Franchises started")?.hint).toBe("Mark a title in a franchise to start this count.");
    expect(findStat(none.yours, "A franchise you finished")).toBeUndefined();

    const started = buildHorrorStats(entries, ["movie:1"], true, [
      { id: 1, name: "Alien", items: ["movie:1", "movie:2"] },
      { id: 2, name: "Saw", items: ["movie:3"] },
    ]);
    expect(findStat(started.yours, "Franchises started")?.hint).toBe("Franchises where you've marked at least one title.");
    expect(findStat(started.yours, "A franchise you finished")).toBeUndefined();

    const one = buildHorrorStats(entries, ["movie:3"], true, [{ id: 2, name: "Saw", items: ["movie:3"] }]);
    expect(findStat(one.yours, "A franchise you finished")?.hint).toBe("Every title in it is marked finished.");

    const both = buildHorrorStats(entries, ["movie:1", "movie:2", "movie:3"], true, [
      { id: 1, name: "Zed", items: ["movie:1"] },
      { id: 2, name: "Alpha", items: ["movie:2"] },
      { id: 3, name: "Pair", items: ["movie:1", "movie:2"] },
    ]);
    expect(findStat(both.yours, "A franchise you finished")?.value).toBe("Pair");
    expect(findStat(both.yours, "A franchise you finished")?.hint).toBe("All 2 titles marked finished.");
  });
});
