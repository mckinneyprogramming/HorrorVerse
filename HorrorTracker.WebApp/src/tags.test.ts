import { describe, expect, it } from "vitest";
import { isLibraryTagId, keywordsMatchTag, LIBRARY_TAGS, presentLibraryTags } from "./tags";

describe("library tags", () => {
  it("recognizes known tag ids", () => {
    expect(isLibraryTagId("slasher")).toBe(true);
    expect(isLibraryTagId("anthology")).toBe(true);
    expect(isLibraryTagId("romance")).toBe(false);
    expect(isLibraryTagId("")).toBe(false);
  });

  it("matches keywords only when the tag and the list both exist", () => {
    expect(keywordsMatchTag(["slasher"], "missing")).toBe(false);
    expect(keywordsMatchTag(undefined, "slasher")).toBe(false);
    expect(keywordsMatchTag([], "slasher")).toBe(false);
    expect(keywordsMatchTag(["romance", "cabin"], "slasher")).toBe(false);
    expect(keywordsMatchTag(["romance", "slasher"], "slasher")).toBe(true);
    expect(LIBRARY_TAGS.length).toBeGreaterThan(0);
  });

  it("lists tags that appear on at least one title", () => {
    expect(presentLibraryTags([])).toEqual([]);
    expect(presentLibraryTags([{ keywords: undefined }, { keywords: ["romance"] }])).toEqual([]);
    expect(presentLibraryTags([{ keywords: ["zombie outbreak"] }, { keywords: ["slasher"] }]).map((tag) => tag.id)).toEqual([
      "slasher",
      "zombie",
    ]);
  });
});
