import { describe, expect, it } from "vitest";
import { testConn, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import { dailyWatchNextSeed, loadReadNext, loadWatchNext, pickWatchNext, type WatchNextItem } from "./watch-next";

function item(id: string, reason: WatchNextItem["reason"], title = id): WatchNextItem {
  const [kind] = id.split(":");
  return {
    id,
    title,
    kind: kind === "documentary" || kind === "show" || kind === "book" ? kind : "movie",
    reason,
  };
}

describe("pickWatchNext", () => {
  it("prefers in-progress episodes, then series, then lists, then vault", () => {
    expect(
      pickWatchNext({
        episodes: [item("show:1", "episode", "Ratched")],
        series: [item("movie:2", "series", "Halloween II")],
        listed: [item("movie:3", "list", "Hereditary")],
        vault: [item("movie:4", "vault", "The Thing")],
      }).map((pick) => pick.id),
    ).toEqual(["show:1", "movie:2", "movie:3", "movie:4"]);
  });

  it("skips duplicates so a listed title already continued is not shown twice", () => {
    expect(
      pickWatchNext({
        episodes: [item("show:1", "episode")],
        series: [],
        listed: [item("show:1", "list")],
        vault: [item("show:1", "vault"), item("movie:9", "vault")],
      }).map((pick) => pick.id),
    ).toEqual(["show:1", "movie:9"]);
  });

  it("fills read next from listed books before vault books", () => {
    expect(
      pickWatchNext({
        episodes: [],
        series: [],
        listed: [item("book:1", "list", "It")],
        vault: [item("book:2", "vault", "Carrie")],
      }).map((pick) => pick.title),
    ).toEqual(["It", "Carrie"]);
  });

  it("keeps vault order stable for the same seed", () => {
    const vault = [item("movie:1", "vault"), item("movie:2", "vault"), item("movie:3", "vault"), item("movie:4", "vault")];
    const first = pickWatchNext({ episodes: [], series: [], listed: [], vault }, 3, 42).map((pick) => pick.id);
    const second = pickWatchNext({ episodes: [], series: [], listed: [], vault }, 3, 42).map((pick) => pick.id);
    expect(first).toEqual(second);
    expect(first).not.toEqual(["movie:1", "movie:2", "movie:3"]);
  });
});

describe("dailyWatchNextSeed", () => {
  it("changes by calendar day, not by hour", () => {
    expect(dailyWatchNextSeed(7, new Date("2026-10-15T01:00:00.000Z"))).toBe(880735);
    expect(dailyWatchNextSeed(7, new Date("2026-10-15T23:00:00.000Z"))).toBe(880735);
    expect(dailyWatchNextSeed(7, new Date("2026-10-15T12:00:00.000Z"))).not.toBe(
      dailyWatchNextSeed(7, new Date("2026-10-16T12:00:00.000Z")),
    );
  });

  it("uses today's UTC date when now is omitted", () => {
    expect(dailyWatchNextSeed(3)).toBeGreaterThan(0);
  });
});

describe("pickWatchNext edges", () => {
  it("stops at the limit and skips blank titles", () => {
    expect(pickWatchNext({
      episodes: [item("movie:1", "episode", "A"), item("movie:2", "episode", "B")],
      series: [],
      listed: [],
      vault: [],
    }, 1).map((pick) => pick.id)).toEqual(["movie:1"]);

    expect(pickWatchNext({
      episodes: [],
      series: [],
      listed: [{ ...item("movie:1", "list"), title: "" }, item("movie:2", "list", "Kept")],
      vault: [],
    }).map((pick) => pick.id)).toEqual(["movie:2"]);
  });

  it("leaves holes in place while shuffling", () => {
    const vault = [
      item("movie:1", "vault", "One"),
      undefined as unknown as WatchNextItem,
      item("movie:3", "vault", "Three"),
      item("movie:4", "vault", "Four"),
    ];
    expect(pickWatchNext({ episodes: [], series: [], listed: [], vault }, 3, 5).map((pick) => pick.id)).toEqual([
      "movie:4",
      "movie:3",
      "movie:1",
    ]);
  });
});

describe("loadWatchNext", () => {
  const connection = testConn("watch-next");

  it("orders episodes, then series, and still loads lists and the vault", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      {
        match: "AS episode_title",
        rows: [
          { id: 1, title: "Ratched", posterpath: "/a.jpg", season_number: 1, episode_number: 2, episode_title: "Start", last_watched: "2024-05-01T00:00:00.000Z" },
          { id: 2, title: "Special", posterpath: "-", season_number: 0, episode_number: 3, episode_title: null, last_watched: "2024-06-01T00:00:00.000Z" },
          { id: 7, title: null, season_number: 1, episode_number: 1, episode_title: "Skip", last_watched: null },
          { id: 3, title: "NamedOnly", season_number: "x", episode_number: 1, episode_title: "Just Name", last_watched: "nope" },
          { id: 4, title: "BlankDetail", season_number: 1, episode_number: 0, episode_title: "  ", last_watched: "" },
          { id: 5, title: "  ", season_number: 2, episode_number: 4, episode_title: "Hidden", last_watched: "2024-01-01T00:00:00.000Z" },
          { id: 6, title: "EpBad", season_number: 2, episode_number: "no", episode_title: "", last_watched: null },
          { id: 0, title: "Skip", season_number: 1, episode_number: 1, episode_title: "Nope" },
        ],
      },
      {
        match: "AS series_title",
        rows: [
          { id: 1, title: "Halloween II", posterpath: "/h.jpg", releaseyear: 1981, series_title: "Halloween", last_watched: "2020-01-01T00:00:00.000Z" },
          { id: 2, title: "Only Series", posterpath: null, releaseyear: 0, series_title: "Saw", last_watched: "bad" },
          { id: 3, title: "Only Year", series_title: "  ", releaseyear: 1999, last_watched: null },
          { id: 4, title: "Neither", series_title: null, releaseyear: null },
          { id: "x", title: "Bad" },
          { id: 5, title: "   " },
        ],
      },
      {
        match: "i.media_kind = 'documentary'",
        rows: [
          { kind: "movie", id: 1, title: "Listed", posterpath: "/a.jpg", releaseyear: 2001 },
          { kind: "documentary", id: 2, title: "Doc", posterpath: null, releaseyear: 0 },
          { kind: "show", id: 3, title: "Show", posterpath: "bad", releaseyear: 2010 },
          { kind: "book", id: 4, title: "Book", posterpath: "/b.jpg", releaseyear: 1990 },
          { kind: "podcast", id: 5, title: "Nope", releaseyear: 2000 },
          { kind: "movie", id: 0, title: "Zero", releaseyear: 2000 },
          { kind: "movie", id: 6, title: "  ", releaseyear: 2000 },
          { kind: "movie", id: 1.2, title: "Fraction", releaseyear: 2000 },
          { kind: "movie", id: 9, title: null, releaseyear: 2000 },
        ],
      },
      {
        match: "FROM documentary d",
        rows: [
          { kind: "movie", id: 8, title: "Vault", posterpath: "/v.jpg", releaseyear: 1979 },
          { kind: "nope", id: 1, title: "Skip" },
        ],
      },
    ], async () => {
      const items = await loadWatchNext(connection, 4);
      expect(items.map((entry) => entry.id)).toEqual(["show:2", "show:1", "show:3", "show:4", "show:6", "movie:1"]);
      expect(items.find((entry) => entry.id === "show:1")).toMatchObject({
        detail: "S1 E2 · Start",
        posterPath: "/a.jpg",
        reason: "episode",
      });
      expect(items.find((entry) => entry.id === "show:2")?.detail).toBe("Specials E3");
      expect(items.find((entry) => entry.id === "show:2")?.posterPath).toBeUndefined();
      expect(items.find((entry) => entry.id === "show:3")?.detail).toBe("Just Name");
      expect(items.find((entry) => entry.id === "show:4")).toEqual({
        id: "show:4",
        title: "BlankDetail",
        kind: "show",
        reason: "episode",
      });
      expect(items.find((entry) => entry.id === "movie:1")).toMatchObject({
        detail: "Halloween · 1981",
        posterPath: "/h.jpg",
        reason: "series",
      });
    });
  });

  it("returns nothing when every watch query fails", async () => {
    await withNeonFetch({}, unreachableNetwork, [{ match: "SELECT", error: "down" }], async () => {
      await expect(loadWatchNext(connection, 4)).resolves.toEqual([]);
    });
  });
});

describe("loadReadNext", () => {
  const connection = testConn("read-next");

  it("lists unfinished books before vault books", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      {
        match: "i.media_kind = 'book'",
        rows: [
          { kind: "book", id: 3, title: "It", posterpath: null, releaseyear: 1986 },
          { kind: "book", id: 0, title: "Skip", releaseyear: 1 },
        ],
      },
      {
        match: "FROM book b",
        rows: [
          { kind: "book", id: 8, title: "Carrie", posterpath: null, releaseyear: 1974 },
          { kind: "nope", id: 1, title: "Skip" },
        ],
      },
    ], async () => {
      await expect(loadReadNext(connection, 4)).resolves.toEqual([
        { id: "book:3", title: "It", kind: "book", reason: "list", detail: "1986" },
        { id: "book:8", title: "Carrie", kind: "book", reason: "vault", detail: "1974" },
      ]);
    });
  });

  it("returns nothing when the book queries fail", async () => {
    await withNeonFetch({}, unreachableNetwork, [{ match: "SELECT", error: "down" }], async () => {
      await expect(loadReadNext(connection, 4)).resolves.toEqual([]);
    });
  });
});
