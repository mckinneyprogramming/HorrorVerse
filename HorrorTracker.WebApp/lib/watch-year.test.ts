import { describe, expect, it } from "vitest";
import { parseWatchYear, watchTimestamp, yearFromCompletedAt } from "./watch-year";

describe("parseWatchYear", () => {
  const now = new Date("2026-10-15T00:00:00Z");

  it("accepts a year from 1888 through next year", () => {
    expect(parseWatchYear(2020, now)).toBe(2020);
    expect(parseWatchYear("1996", now)).toBe(1996);
    expect(parseWatchYear(1887, now)).toBeUndefined();
    expect(parseWatchYear(2028, now)).toBeUndefined();
  });
});

describe("yearFromCompletedAt", () => {
  it("reads a UTC year and skips empty dates", () => {
    expect(yearFromCompletedAt("2020-07-01T12:00:00.000Z")).toBe(2020);
    expect(yearFromCompletedAt(null)).toBeUndefined();
  });
});

describe("watchTimestamp", () => {
  it("stores mid-year so the row is dated but not today", () => {
    expect(watchTimestamp(2020)).toBe("2020-07-01T12:00:00.000Z");
  });
});
