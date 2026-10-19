import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./catalog";
import { buildAchievements } from "./achievements";

const scream: CatalogEntry = {
  id: "movie:1",
  mediaId: 1,
  title: "Scream",
  kind: "movie",
  completed: false,
  totalTime: 111,
  keywords: ["slasher"],
};

const aliens: CatalogEntry = {
  id: "movie:2",
  mediaId: 2,
  title: "Aliens",
  kind: "movie",
  completed: false,
  totalTime: 137,
  seriesId: 10,
};

const alien3: CatalogEntry = {
  id: "movie:3",
  mediaId: 3,
  title: "Alien 3",
  kind: "movie",
  completed: false,
  totalTime: 114,
  seriesId: 10,
};

const alienSeries: CatalogEntry = {
  id: "series:10",
  mediaId: 10,
  title: "Alien",
  kind: "series",
  completed: false,
};

const night: CatalogEntry = {
  id: "book:1",
  mediaId: 1,
  title: "Night Shift",
  kind: "book",
  completed: false,
};

const dawn: CatalogEntry = {
  id: "movie:4",
  mediaId: 4,
  title: "Dawn of the Dead",
  kind: "movie",
  completed: false,
  keywords: ["zombie"],
};

function badge(id: string, finishedIds: string[], extra: Partial<Parameters<typeof buildAchievements>[0]> = {}) {
  return buildAchievements({
    entries: extra.entries && extra.entries.length > 0 ? extra.entries : [scream, aliens, alien3, alienSeries, night, dawn],
    finishedIds,
    franchises: extra.franchises,
    listCount: extra.listCount,
    lists: extra.lists,
    yearCount: extra.yearCount,
    watchedYears: extra.watchedYears,
  }).find((item) => item.id === id);
}

describe("buildAchievements", () => {
  it("keeps every badge locked with no progress", () => {
    const achievements = buildAchievements({ entries: [scream], finishedIds: [] });

    expect(achievements).toHaveLength(14);
    expect(achievements.every((item) => !item.earned)).toBe(true);
    expect(badge("first-blood", [])?.current).toBe(0);
    expect(badge("body-count", [])?.hint).toBe("Finish 10 movies.");
  });

  it("earns First Blood on the first finished movie, not Body Count", () => {
    expect(badge("first-blood", ["movie:1"])?.earned).toBe(true);
    expect(badge("first-blood", ["movie:1"])?.hint).toBe("Your first film in the vault.");
    expect(badge("body-count", ["movie:1"])?.earned).toBe(false);
    expect(badge("body-count", ["movie:1"])?.current).toBe(1);
    expect(badge("first-cut", ["movie:1"])?.earned).toBe(true);
  });

  it("counts a series finished by its films or by the series mark", () => {
    expect(badge("the-collector", ["movie:2", "movie:3"])?.earned).toBe(true);
    expect(badge("the-collector", ["series:10"])?.earned).toBe(true);
    expect(badge("the-collector", ["movie:2"])?.earned).toBe(false);
  });

  it("earns Franchise Killer only when every title in a franchise is finished", () => {
    const franchises = [{ id: 1, name: "Alien", items: ["series:10", "movie:2", "movie:3"] }];
    expect(badge("franchise-killer", ["movie:2", "movie:3"], { entries: [aliens, alien3, alienSeries], franchises })?.earned).toBe(
      false,
    );
    expect(
      badge("franchise-killer", ["series:10", "movie:2", "movie:3"], { entries: [aliens, alien3, alienSeries], franchises })
        ?.earned,
    ).toBe(true);
  });

  it("unlocks kind, tag, list, year, and runtime badges from existing marks", () => {
    expect(badge("dark-scholar", ["book:1"])?.earned).toBe(true);
    expect(badge("grave-raiser", ["movie:4"])?.earned).toBe(true);
    expect(badge("the-curator", [], { entries: [scream], listCount: 1 })?.earned).toBe(true);
    expect(badge("when-it-happened", [], { entries: [scream], yearCount: 1 })?.earned).toBe(true);
    const longNight: CatalogEntry = { id: "movie:9", mediaId: 9, title: "Long Night", kind: "movie", completed: false, totalTime: 480 };
    expect(badge("all-nighter", ["movie:9"], { entries: [longNight] })?.earned).toBe(true);
    expect(badge("all-nighter", ["movie:1"])?.earned).toBe(false);
    expect(badge("all-nighter", ["movie:1"])?.current).toBe(1);
  });

  it("lists the finished titles, series, franchises, lists, and years that earned a badge", () => {
    expect(badge("first-blood", ["movie:1"])?.credits.map((item) => item.title)).toEqual(["Scream"]);
    expect(badge("dark-scholar", ["book:1"])?.credits.map((item) => item.detail)).toEqual(["Book"]);
    const collector = badge("the-collector", ["movie:2", "movie:3"]);
    expect(collector?.credits.map((item) => item.title)).toEqual(["Alien", "Alien 3", "Aliens"]);
    const franchises = [{ id: 1, name: "Alien", items: ["series:10", "movie:2", "movie:3"] }];
    const killer = badge("franchise-killer", ["series:10", "movie:2", "movie:3"], {
      entries: [aliens, alien3, alienSeries],
      franchises,
    });
    expect(killer?.credits.map((item) => item.title)).toEqual(["Alien", "Alien", "Alien 3", "Aliens"]);
    expect(badge("the-curator", [], { entries: [scream], lists: [{ id: 4, name: "October" }] })?.credits[0]?.title).toBe(
      "October",
    );
    expect(
      badge("when-it-happened", [], { entries: [scream], watchedYears: { "movie:1": 1996 } })?.credits[0]?.detail,
    ).toBe("1996");
  });
});
