import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./catalog";
import {
  finishedTitleCount,
  recapStoryCopy,
  recapTitlesFromCatalog,
  storyFilename,
  storyTag,
  titleKicker,
  titleStoryCopy,
} from "./story";

const scream: CatalogEntry = {
  id: "movie:1",
  mediaId: 1,
  title: "Scream",
  kind: "movie",
  completed: true,
  releaseYear: 1996,
  totalTime: 111,
  seriesTitle: "Scream",
  keywords: ["slasher", "mask"],
};

const alien: CatalogEntry = {
  id: "series:10",
  mediaId: 10,
  title: "Alien",
  kind: "series",
  completed: true,
};

describe("titleStoryCopy", () => {
  it("adds runtime, series, and a tag beside year and kind", () => {
    expect(
      titleStoryCopy({
        title: "Scream",
        year: 1996,
        kind: "movie",
        displayName: "Riley",
        seriesTitle: "Scream",
        totalTime: 111,
        keywords: ["slasher"],
      }),
    ).toEqual({
      kicker: titleKicker("Scream"),
      title: "Scream",
      meta: "1996 · Movies · 1 hr 51 min",
      series: "Scream",
      tag: "Slashers",
      byline: "Watched by Riley",
    });
  });

  it("picks a stable kicker and omits empty extras", () => {
    const copy = titleStoryCopy({ title: "The Thing", kind: "movie", displayName: "  " });
    expect(copy.kicker).toBe(titleKicker("The Thing"));
    expect(copy.meta).toBe("Movies");
    expect(copy.series).toBeUndefined();
    expect(copy.tag).toBeUndefined();
  });

  it("does not repeat the title as a series on series cards", () => {
    expect(titleStoryCopy({ title: "Alien", kind: "series", displayName: "Riley", seriesTitle: "Alien" }).series).toBeUndefined();
  });
});

describe("recapStoryCopy", () => {
  it("lists hours, extras, and recent titles", () => {
    const copy = recapStoryCopy({
      hoursLabel: "12 hr",
      finishedCount: 3,
      titles: ["Scream", "Aliens", "The Thing"],
      allNighters: 2,
      longestNight: "Aliens",
    });
    expect(copy.empty).toBe(false);
    expect(copy.heading).toBe("Your nights");
    expect(copy.hours).toBe("12 hr");
    expect(copy.count).toBe("3 titles survived");
    expect(copy.extras).toEqual(["2 all-nighters", "Longest night · Aliens"]);
    expect(copy.titles).toEqual(["Scream", "Aliens", "The Thing"]);
  });

  it("explains an empty vault", () => {
    const copy = recapStoryCopy({ hoursLabel: "0 hr", finishedCount: 0, titles: [] });
    expect(copy.empty).toBe(true);
    expect(copy.count).toContain("Mark a title finished");
    expect(copy.extras).toEqual([]);
    expect(copy.titles).toEqual([]);
  });
});

describe("storyTag", () => {
  it("uses the first library tag that matches keywords", () => {
    expect(storyTag(["found footage", "cabin"])).toBe("Found footage");
  });
});

describe("recapTitlesFromCatalog", () => {
  it("skips series and keeps catalog order of recent ids", () => {
    expect(recapTitlesFromCatalog([scream, alien], ["series:10", "movie:1"])).toEqual(["Scream"]);
  });
});

describe("finishedTitleCount", () => {
  it("ignores series marks so recaps do not double-count sagas", () => {
    expect(finishedTitleCount([scream, alien], ["movie:1", "series:10"])).toBe(1);
  });
});

describe("storyFilename", () => {
  it("slugifies the title", () => {
    expect(storyFilename("Scream (1996)")).toBe("horrorverse-scream-1996.png");
  });
});
