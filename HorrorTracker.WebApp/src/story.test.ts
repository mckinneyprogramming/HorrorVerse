import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./catalog";
import {
  finishedTitleCount,
  recapStoryCopy,
  recapTitlesFromCatalog,
  storyFilename,
  titleStoryCopy,
} from "./story";

const scream: CatalogEntry = {
  id: "movie:1",
  mediaId: 1,
  title: "Scream",
  kind: "movie",
  completed: true,
  releaseYear: 1996,
};

const alien: CatalogEntry = {
  id: "series:10",
  mediaId: 10,
  title: "Alien",
  kind: "series",
  completed: true,
};

describe("titleStoryCopy", () => {
  it("builds a survived line with year and kind", () => {
    expect(titleStoryCopy({ title: "Scream", year: 1996, kind: "movie", displayName: "Riley" })).toEqual({
      kicker: "Survived",
      title: "Scream",
      meta: "1996 · Movies",
      byline: "Watched by Riley",
    });
  });

  it("omits a missing year", () => {
    expect(titleStoryCopy({ title: "The Thing", kind: "movie", displayName: "  " }).meta).toBe("Movies");
  });
});

describe("recapStoryCopy", () => {
  it("lists hours, count, and recent titles", () => {
    const copy = recapStoryCopy({
      hoursLabel: "12 hr",
      finishedCount: 3,
      titles: ["Scream", "Aliens", "The Thing"],
    });
    expect(copy.empty).toBe(false);
    expect(copy.heading).toBe("Your nights");
    expect(copy.hours).toBe("12 hr");
    expect(copy.count).toBe("3 titles survived");
    expect(copy.titles).toEqual(["Scream", "Aliens", "The Thing"]);
  });

  it("explains an empty vault", () => {
    const copy = recapStoryCopy({ hoursLabel: "0 hr", finishedCount: 0, titles: [] });
    expect(copy.empty).toBe(true);
    expect(copy.count).toContain("Mark a title finished");
    expect(copy.titles).toEqual([]);
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
