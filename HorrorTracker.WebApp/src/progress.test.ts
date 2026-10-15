import { describe, expect, it } from "vitest";
import { readRecentPosters, readWatchNext, readWatchedYears } from "./progress";

describe("readWatchedYears", () => {
  it("keeps integer years keyed by catalog id", () => {
    expect(readWatchedYears({ watchedYears: { "show:1": 2020, "movie:2": 1996.5 } })).toEqual({
      "show:1": 2020,
    });
    expect(readWatchedYears({})).toEqual({});
  });
});

describe("readWatchNext", () => {
  it("keeps titled catalog picks and drops junk", () => {
    expect(
      readWatchNext({
        watchNext: [
          { id: "show:1", title: "Ratched", kind: "show", reason: "episode", detail: "S1 E2 · The Angel of Mercy", posterPath: "/abc.jpg" },
          { id: "movie:2", title: "", kind: "movie", reason: "vault" },
          { id: "movie:3", title: "Hereditary", kind: "game", reason: "vault" },
        ],
      }),
    ).toEqual([
      {
        id: "show:1",
        title: "Ratched",
        kind: "show",
        reason: "episode",
        detail: "S1 E2 · The Angel of Mercy",
        posterPath: "/abc.jpg",
      },
    ]);
    expect(readWatchNext({})).toEqual([]);
  });
});

describe("readRecentPosters", () => {
  it("keeps TMDb paths keyed by catalog id", () => {    expect(
      readRecentPosters({
        recentPosters: { "movie:12": "/abc123.jpg", "show:1": "https://evil.example/x.jpg" },
      }),
    ).toEqual({ "movie:12": "/abc123.jpg" });
    expect(readRecentPosters({})).toEqual({});
  });
});
