import { describe, expect, it } from "vitest";
import { filmWindows, nextFilmCursor } from "./horror-import";

describe("filmWindows", () => {
  it("covers 1895 through next year in five-year slices", () => {
    const windows = filmWindows(new Date("2026-09-26T00:00:00Z"));
    expect(windows[0]).toEqual({ fromYear: 1895, from: "1895-01-01", to: "1899-12-31" });
    expect(windows.at(-1)?.to).toBe("2027-12-31");
  });
});

describe("nextFilmCursor", () => {
  const windows = [
    { fromYear: 1895 },
    { fromYear: 1900 },
  ];

  it("stays on the page until the slice is consumed", () => {
    expect(nextFilmCursor({ fromYear: 1895, page: 1, index: 0, done: false }, 8, 3, 20, windows)).toEqual({
      fromYear: 1895,
      page: 1,
      index: 8,
      done: false,
    });
  });

  it("advances the page, then the date window", () => {
    expect(nextFilmCursor({ fromYear: 1895, page: 1, index: 16, done: false }, 4, 2, 20, windows)).toEqual({
      fromYear: 1895,
      page: 2,
      index: 0,
      done: false,
    });
    expect(nextFilmCursor({ fromYear: 1895, page: 2, index: 0, done: false }, 5, 2, 5, windows)).toEqual({
      fromYear: 1900,
      page: 1,
      index: 0,
      done: false,
    });
  });

  it("marks the job done after the last window", () => {
    expect(nextFilmCursor({ fromYear: 1900, page: 1, index: 0, done: false }, 2, 1, 2, windows).done).toBe(true);
  });
});
