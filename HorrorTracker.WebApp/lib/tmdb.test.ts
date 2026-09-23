import { describe, expect, it } from "vitest";
import { asId, asPositiveInt, asRecord, asResults, isDocumentary, isHorrorAdjacent, seriesTitle, yearFrom } from "./tmdb";

describe("yearFrom", () => {
  it("reads a four-digit year from a date", () => {
    expect(yearFrom("2019-04-01")).toBe(2019);
  });

  it("rejects values that are not years", () => {
    expect(yearFrom("soon")).toBeUndefined();
    expect(yearFrom("")).toBeUndefined();
  });
});

describe("asId", () => {
  it("reads a positive integer from a named field", () => {
    expect(asId({ seriesid: 42 }, "seriesid")).toBe(42);
    expect(asId({ id: 0 })).toBeUndefined();
  });
});

describe("asResults", () => {
  it("returns object rows from a TMDb payload", () => {
    expect(asResults({ results: [{ id: 1 }, "skip"] })).toEqual([{ id: 1 }]);
    expect(asResults({})).toEqual([]);
  });
});

describe("genre filters", () => {
  it("recognizes horror-adjacent and documentary genre lists", () => {
    expect(isHorrorAdjacent([27, 18])).toBe(true);
    expect(isHorrorAdjacent([18])).toBe(false);
    expect(isDocumentary([99])).toBe(true);
    expect(isDocumentary([27])).toBe(false);
  });
});

describe("helpers", () => {
  it("narrows records and runtimes", () => {
    expect(asRecord({ id: 1 })).toEqual({ id: 1 });
    expect(asRecord("no")).toBeUndefined();
    expect(asPositiveInt("7")).toBe(7);
    expect(seriesTitle("Scream Collection")).toBe("Scream");
  });
});
