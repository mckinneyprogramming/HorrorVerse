import { describe, expect, it } from "vitest";
import { readWatchedYears } from "./progress";

describe("readWatchedYears", () => {
  it("keeps integer years keyed by catalog id", () => {
    expect(readWatchedYears({ watchedYears: { "show:1": 2020, "movie:2": 1996.5 } })).toEqual({
      "show:1": 2020,
    });
    expect(readWatchedYears({})).toEqual({});
  });
});
