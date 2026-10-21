import { describe, expect, it } from "vitest";
import { testConn, unreachableNetwork, withNeonFetch, jsonResponse } from "../test-helpers/http";
import {
  ensureKeywordSchema,
  hasKeywords,
  replaceSeriesKeywords,
  saveDocumentaryKeywords,
  saveKeywords,
  saveMovieKeywords,
  saveShowKeywords,
} from "./keywords";

const CONN = testConn("keywords");

describe("saveKeywords", () => {
  it("ignores tmdb ids that are not positive integers", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await saveMovieKeywords(CONN, 1, 0);
      await saveDocumentaryKeywords(CONN, 1, -3);
      await saveShowKeywords(CONN, 1, 1.5);
      await saveKeywords(CONN, "movie", 1, Number.NaN, "movie", false);
      expect(neon.calls).toEqual([]);
    });
  });

  it("stores movie keywords and skips invalid rows", async () => {
    const urls: string[] = [];
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      urls.push(url);
      return jsonResponse({
        keywords: [
          null,
          "nope",
          { id: 0, name: "zero" },
          { id: -1, name: "negative" },
          { id: 1.5, name: "fraction" },
          { id: 2, name: "" },
          { id: 3, name: "x".repeat(81) },
          { id: 4, name: " ghost " },
          { id: "5", name: "a" },
          { id: 6, name: "y".repeat(80) },
          { id: 7 },
        ],
      });
    }, [], async (neon) => {
      await saveMovieKeywords(CONN, 9, 44);
      expect(urls.some((url) => url.includes("/movie/44/keywords"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("UPDATE movie SET tmdbid"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("UPDATE documentary SET tmdbid"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("AS present"))).toBe(false);
      const inserts = neon.calls.filter((call) => call.query.includes("INSERT INTO media_keyword"));
      expect(inserts.map((call) => call.params[3])).toEqual(["ghost", "a", "y".repeat(80)]);
    });
  });

  it("updates documentary ids and reads keywords from results", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({
      keywords: "no",
      results: [{ id: 9, name: "demon" }],
    }), [], async (neon) => {
      await saveDocumentaryKeywords(CONN, 3, 8, false);
      expect(neon.calls.some((call) => call.query.includes("UPDATE documentary SET tmdbid"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("UPDATE movie SET tmdbid"))).toBe(false);
      expect(neon.calls.filter((call) => call.query.includes("INSERT INTO media_keyword"))).toHaveLength(1);
    });
  });

  it("stores show keywords when the payload has neither list", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ id: 1 }), [], async (neon) => {
      await saveShowKeywords(CONN, 2, 6);
      expect(neon.calls.some((call) => call.query.includes("UPDATE movie SET tmdbid"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("UPDATE documentary SET tmdbid"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("DELETE FROM media_keyword"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO media_keyword"))).toBe(false);
    });
  });

  it("returns before fetching when keywords are already stored", async () => {
    const urls: string[] = [];
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      urls.push(url);
      return jsonResponse({ keywords: [{ id: 1, name: "ghost" }] });
    }, [{ match: "AS present", rows: [{ present: 1 }] }], async (neon) => {
      await saveMovieKeywords(CONN, 9, 44, true);
      expect(urls).toEqual([]);
      expect(neon.calls.some((call) => call.query.includes("AS present"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("DELETE FROM media_keyword"))).toBe(false);
    });
  });

  it("fetches when skip is requested but nothing is stored yet", async () => {
    const urls: string[] = [];
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      urls.push(url);
      return jsonResponse({ keywords: [] });
    }, [{ match: "AS present", rows: [] }], async () => {
      await saveKeywords(CONN, "show", 2, 6, "tv", true);
      expect(urls.some((url) => url.includes("/tv/6/keywords"))).toBe(true);
    });
  });

  it("swallows schema and TMDb failures", async () => {
    await withNeonFetch({ TMDBKey: "key" }, unreachableNetwork, [
      { match: "ALTER TABLE movie ADD COLUMN IF NOT EXISTS tmdbid", error: "nope" },
    ], async () => {
      await expect(saveMovieKeywords(CONN, 1, 4)).resolves.toBeUndefined();
    });

    await withNeonFetch({ TMDBKey: undefined }, unreachableNetwork, [], async () => {
      await expect(saveShowKeywords(CONN, 1, 4, false)).resolves.toBeUndefined();
    });
  });
});

describe("series keywords", () => {
  it("creates the keyword tables and reports whether any row exists", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await ensureKeywordSchema(CONN);
      expect(neon.calls).toHaveLength(3);
      await expect(hasKeywords(CONN, "movie", 1)).resolves.toBe(false);
    });

    await withNeonFetch({}, unreachableNetwork, [
      { match: "AS present", rows: [{ present: 1 }] },
    ], async () => {
      await expect(hasKeywords(CONN, "series", 2)).resolves.toBe(true);
    });
  });

  it("replaces series keywords and ignores database errors", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await replaceSeriesKeywords(CONN, 5);
      expect(neon.calls.some((call) => call.query.includes("media_kind = 'series'"))).toBe(true);
    });

    await withNeonFetch({}, unreachableNetwork, [
      { match: "ALTER TABLE movie ADD COLUMN IF NOT EXISTS tmdbid", error: "nope" },
    ], async () => {
      await expect(replaceSeriesKeywords(CONN, 5)).resolves.toBeUndefined();
    });
  });
});
