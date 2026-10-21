import { describe, expect, it } from "vitest";
import { jsonResponse, testConn, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import {
  addMovieToFranchisesContainingSeries,
  addMovieToListsContainingSeries,
  ensureShowTmdbId,
  filmsFromCollection,
  findMovieId,
  upsertShowSeasons,
} from "./catalog";

const CONN = testConn("catalog");

describe("filmsFromCollection", () => {
  it("returns no films when the collection has no dated parts", async () => {
    await expect(filmsFromCollection({})).resolves.toEqual([]);
    await expect(filmsFromCollection({ parts: ["skip", { id: 1 }] })).resolves.toEqual([]);
  });

  it("loads dated parts and falls back to the collection record", async () => {
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      const id = url.match(/\/movie\/(\d+)/)?.[1];
      const movies: Record<string, unknown> = {
        10: { title: null, poster_path: "nope", runtime: 0, release_date: "nope" },
        11: { poster_path: null, runtime: 90, release_date: "bad" },
        12: { title: "Full", poster_path: "/full.jpg", runtime: 100, release_date: "1988-06-01" },
        13: { title: "No Year On Film", runtime: -5 },
        14: { title: null },
      };
      return jsonResponse(movies[id ?? ""] ?? {});
    }, [], async () => {
      await expect(filmsFromCollection({
        parts: [
          "skip",
          { id: 1 },
          { id: 0, release_date: "1990-01-01", title: "Zero" },
          { id: 1.5, release_date: "1990-01-01", title: "Fraction" },
          { id: 10, release_date: "1999-01-01", title: "Fallback", poster_path: "/part.jpg" },
          { id: 11, release_date: "2001-05-01", title: "From Part", poster_path: "/part.jpg" },
          { id: 12, release_date: "1988-01-01", title: "Ignored", poster_path: "/ignored.jpg" },
          { id: 13, release_date: "1975-06-01", title: "Year From Part" },
          { id: 14, release_date: "1980-01-01" },
        ],
      })).resolves.toEqual([
        { tmdbId: 10, title: "Fallback", year: 1999, runtime: 0, posterPath: "/part.jpg" },
        { tmdbId: 11, title: "From Part", year: 2001, runtime: 90, posterPath: "/part.jpg" },
        { tmdbId: 12, title: "Full", year: 1988, runtime: 100, posterPath: "/full.jpg" },
        { tmdbId: 13, title: "No Year On Film", year: 1975, runtime: 0 },
      ]);
    });
  });
});

describe("findMovieId", () => {
  it("returns a tmdb match without the title query", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "WHERE tmdbid = $1", rows: [{ id: 7 }] },
    ], async (neon) => {
      await expect(findMovieId(CONN, "It", 1990, 15)).resolves.toBe(7);
      expect(neon.calls.some((call) => call.query.includes("lower(title)"))).toBe(false);
    });
  });

  it("uses the title when the tmdb lookup misses, throws, or is not positive", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "lower(title)", rows: [{ id: 9 }] },
    ], async (neon) => {
      await expect(findMovieId(CONN, "It", 1990, 15)).resolves.toBe(9);
      expect(neon.calls.find((call) => call.query.includes("lower(title)"))?.params).toEqual(["It", 1990]);
    });

    await withNeonFetch({}, unreachableNetwork, [
      { match: "WHERE tmdbid = $1", error: "no column" },
      { match: "lower(title)", rows: [{ id: 8 }] },
    ], async (neon) => {
      await expect(findMovieId(CONN, "It", undefined, 15)).resolves.toBe(8);
      expect(neon.calls.find((call) => call.query.includes("lower(title)"))?.params).toEqual(["It", 0]);
    });

    await withNeonFetch({}, unreachableNetwork, [
      { match: "lower(title)", rows: [] },
    ], async (neon) => {
      await expect(findMovieId(CONN, "It", 1980, 0)).resolves.toBeUndefined();
      await expect(findMovieId(CONN, "It", 1980, -5)).resolves.toBeUndefined();
      await expect(findMovieId(CONN, "It", 1980)).resolves.toBeUndefined();
      expect(neon.calls.some((call) => call.query.includes("tmdbid"))).toBe(false);
    });
  });
});

describe("list and franchise membership", () => {
  it("adds a movie that belongs to a collected series", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await addMovieToListsContainingSeries(CONN, 2, 9);
      await addMovieToFranchisesContainingSeries(CONN, 2, 9);
      expect(neon.calls.map((call) => call.params)).toEqual([[9, 2], [9, 2]]);
    });
  });

  it("ignores missing list and franchise tables", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "user_list_item", error: "missing" },
      { match: "franchise_item", error: "missing" },
    ], async () => {
      await expect(addMovieToListsContainingSeries(CONN, 2, 9)).resolves.toBeUndefined();
      await expect(addMovieToFranchisesContainingSeries(CONN, 2, 9)).resolves.toBeUndefined();
    });
  });
});

describe("ensureShowTmdbId", () => {
  it("returns the id already stored on the show", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "SELECT tmdbid FROM show", rows: [{ tmdbid: 42 }] },
    ], async (neon) => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBe(42);
      expect(neon.calls).toHaveLength(1);
    });
  });

  it("gives up when the stored title is too short or the search has no id", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ results: [] }), [
      { match: "SELECT tmdbid FROM show", rows: [] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A", releaseyear: 2020 }] },
    ], async () => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBeUndefined();
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ results: [{ name: "Other" }] }), [
      { match: "SELECT tmdbid FROM show", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [] },
    ], async () => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBeUndefined();
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ results: [] }), [
      { match: "SELECT tmdbid FROM show", rows: [] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "Midnight Mass", releaseyear: 2021 }] },
    ], async () => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBeUndefined();
    });
  });

  it("matches the same title and year, then falls back to the first same title or any result", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({
      results: [
        { name: null, id: 1 },
        { name: "Other", id: 2 },
        { name: " midnight mass ", first_air_date: "2010-01-01", id: 3 },
        { name: "Midnight Mass", first_air_date: "2021-09-24", id: 4 },
      ],
    }), [
      { match: "SELECT tmdbid FROM show", rows: [] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "Midnight Mass", releaseyear: 2021 }] },
    ], async (neon) => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBe(4);
      expect(neon.calls.some((call) => call.query.startsWith("UPDATE show") && call.params[0] === 4)).toBe(true);
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({
      results: [
        { name: "Midnight Mass", first_air_date: "2010-01-01", id: 3 },
        { name: "Midnight Mass", first_air_date: "2011-01-01", id: 8 },
      ],
    }), [
      { match: "SELECT tmdbid FROM show", rows: [] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "Midnight Mass", releaseyear: 2021 }] },
    ], async () => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBe(3);
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({
      results: [{ name: "Midnight Mass", first_air_date: "2010-01-01", id: 6 }],
    }), [
      { match: "SELECT tmdbid FROM show", rows: [] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "Midnight Mass", releaseyear: 0 }] },
    ], async () => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBe(6);
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({
      results: [{ name: "Something Else", id: 11 }],
    }), [
      { match: "SELECT tmdbid FROM show", rows: [] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "Midnight Mass" }] },
    ], async () => {
      await expect(ensureShowTmdbId(CONN, 3)).resolves.toBe(11);
    });
  });
});

describe("upsertShowSeasons", () => {
  it("upserts named seasons, specials, and generated season titles", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await upsertShowSeasons(CONN, 4, {
        seasons: [
          null,
          { season_number: -1, name: "Nope" },
          { season_number: 1.5, name: "Half" },
          { season_number: 1, name: "Finale" },
          { season_number: 0, name: "" },
          { season_number: 2, name: null },
          { season_number: 3, name: "   " },
        ],
      });
      expect(neon.calls.map((call) => call.params)).toEqual([
        [4, 1, "Finale"],
        [4, 0, "Specials"],
        [4, 2, "Season 2"],
        [4, 3, "Season 3"],
      ]);
    });
  });

  it("does nothing when seasons are missing", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await upsertShowSeasons(CONN, 4, {});
      expect(neon.calls).toEqual([]);
    });
  });
});
