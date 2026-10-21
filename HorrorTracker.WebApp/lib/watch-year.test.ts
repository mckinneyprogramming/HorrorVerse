import { describe, expect, it } from "vitest";
import { parseWatchYear, watchTimestamp, yearFromCompletedAt } from "./watch-year";

describe("parseWatchYear", () => {
  const now = new Date("2026-10-15T00:00:00Z");

  it("accepts a year from 1888 through next year", () => {
    expect(parseWatchYear(2020, now)).toBe(2020);
    expect(parseWatchYear("1996", now)).toBe(1996);
    expect(parseWatchYear(1887, now)).toBeUndefined();
    expect(parseWatchYear(2028, now)).toBeUndefined();
    expect(parseWatchYear(1888, now)).toBe(1888);
    expect(parseWatchYear(2027, now)).toBe(2027);
    expect(parseWatchYear(" 1999 ", now)).toBe(1999);
    expect(parseWatchYear(null, now)).toBeUndefined();
    expect(parseWatchYear("  ", now)).toBeUndefined();
    expect(parseWatchYear("2020.5", now)).toBeUndefined();
  });

  it("uses the current UTC year when now is omitted", () => {
    expect(parseWatchYear(new Date().getUTCFullYear())).toBe(new Date().getUTCFullYear());
  });
});

describe("yearFromCompletedAt", () => {
  it("reads a UTC year and skips empty dates", () => {
    expect(yearFromCompletedAt("2020-07-01T12:00:00.000Z")).toBe(2020);
    expect(yearFromCompletedAt(null)).toBeUndefined();
    expect(yearFromCompletedAt(undefined)).toBeUndefined();
    expect(yearFromCompletedAt("")).toBeUndefined();
    expect(yearFromCompletedAt(new Date("2021-03-01T00:00:00.000Z"))).toBe(2021);
    expect(yearFromCompletedAt("not-a-date")).toBeUndefined();
    expect(yearFromCompletedAt(0)).toBe(2000);
  });
});

describe("watchTimestamp", () => {
  it("stores mid-year so the row is dated but not today", () => {
    expect(watchTimestamp(2020)).toBe("2020-07-01T12:00:00.000Z");
  });
});
