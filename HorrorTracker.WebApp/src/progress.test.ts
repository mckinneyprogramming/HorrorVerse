import { describe, expect, it } from "vitest";
import { readRecentPosters, readWatchedYears } from "./progress";

describe("readWatchedYears", () => {
  it("keeps integer years keyed by catalog id", () => {
    expect(readWatchedYears({ watchedYears: { "show:1": 2020, "movie:2": 1996.5 } })).toEqual({
      "show:1": 2020,
    });
    expect(readWatchedYears({})).toEqual({});
  });
});

describe("readRecentPosters", () => {
  it("keeps TMDb paths keyed by catalog id", () => {
    expect(
      readRecentPosters({
        recentPosters: { "movie:12": "/abc123.jpg", "show:1": "https://evil.example/x.jpg" },
      }),
    ).toEqual({ "movie:12": "/abc123.jpg" });
    expect(readRecentPosters({})).toEqual({});
  });
});
