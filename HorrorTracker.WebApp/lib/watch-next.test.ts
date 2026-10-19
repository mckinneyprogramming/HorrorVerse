import { describe, expect, it } from "vitest";
import { dailyWatchNextSeed, pickWatchNext, type WatchNextItem } from "./watch-next";

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
    expect(dailyWatchNextSeed(7, new Date("2026-10-15T01:00:00.000Z"))).toBe(
      dailyWatchNextSeed(7, new Date("2026-10-15T23:00:00.000Z")),
    );
    expect(dailyWatchNextSeed(7, new Date("2026-10-15T12:00:00.000Z"))).not.toBe(
      dailyWatchNextSeed(7, new Date("2026-10-16T12:00:00.000Z")),
    );
  });
});
