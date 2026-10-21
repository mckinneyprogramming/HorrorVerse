import { describe, expect, it } from "vitest";
import { jsonResponse, textResponse, withNeonFetch } from "../test-helpers/http";
import { HttpError } from "./neon";
import {
  asId,
  asPositiveInt,
  asRecord,
  asResults,
  collectionIsHorrorAdjacent,
  isDocumentary,
  isHorrorAdjacent,
  requireTitle,
  seriesTitle,
  showTotalMinutes,
  tmdbJson,
  tmdbJsonOptional,
  trimOverview,
  yearFrom,
} from "./tmdb";

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

describe("showTotalMinutes", () => {
  it("uses series episode_run_time when TMDb provides it", () => {
    expect(showTotalMinutes({ number_of_episodes: 10, episode_run_time: [45] })).toBe(450);
  });

  it("falls back to the last aired episode when episode_run_time is empty", () => {
    expect(
      showTotalMinutes({
        number_of_episodes: 8,
        episode_run_time: [],
        last_episode_to_air: { runtime: 52 },
      }),
    ).toBe(416);
  });

  it("returns 0 when TMDb has no usable runtime", () => {
    expect(showTotalMinutes({ number_of_episodes: 8, episode_run_time: [] })).toBe(0);
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

describe("tmdb value helpers", () => {
  it("rejects empty, non-numeric, and out-of-range values", () => {
    expect(asRecord(null)).toBeUndefined();
    expect(asRecord(0)).toBeUndefined();
    expect(asRecord([1])).toEqual([1]);
    expect(asResults({ results: [null, 0, "skip", { id: 2 }] })).toEqual([{ id: 2 }]);
    expect(asResults({ results: "nope" })).toEqual([]);
    expect(asId(undefined)).toBeUndefined();
    expect(asId({})).toBeUndefined();
    expect(asPositiveInt("nope")).toBeUndefined();
    expect(asPositiveInt(0)).toBeUndefined();
    expect(asPositiveInt(-4)).toBeUndefined();
    expect(asPositiveInt(1.5)).toBeUndefined();
    expect(yearFrom(null)).toBeUndefined();
    expect(yearFrom(undefined)).toBeUndefined();
    expect(yearFrom("1888-01-01")).toBe(1888);
    expect(yearFrom("3000-12-31")).toBe(3000);
    expect(yearFrom("1887-01-01")).toBeUndefined();
    expect(yearFrom("3001-01-01")).toBeUndefined();
    expect(yearFrom("18.8")).toBeUndefined();
    expect(isHorrorAdjacent(null)).toBe(false);
    expect(isHorrorAdjacent([])).toBe(false);
    expect(isDocumentary("99")).toBe(false);
    expect(isDocumentary([])).toBe(false);
    expect(seriesTitle("Hellraiser collection")).toBe("Hellraiser");
    expect(seriesTitle("Collection")).toBe("Collection");
    expect(seriesTitle("   ")).toBe("");
    expect(seriesTitle("Foo")).toBe("Foo");
  });

  it("totals episode minutes from runtimes, aired episodes, and the caller fallback", () => {
    expect(showTotalMinutes({ number_of_episodes: 2, episode_run_time: [0, Number.POSITIVE_INFINITY, 9] })).toBe(18);
    expect(showTotalMinutes({ number_of_episodes: 0, episode_run_time: [40] }, 99)).toBe(40);
    expect(showTotalMinutes({ number_of_episodes: 3 }, 12)).toBe(36);
    expect(showTotalMinutes({ number_of_episodes: "nope" })).toBe(0);
    expect(
      showTotalMinutes({
        number_of_episodes: -4,
        episode_run_time: "nope",
        last_episode_to_air: "x",
        next_episode_to_air: { runtime: "bad" },
      }),
    ).toBe(0);
    expect(
      showTotalMinutes({
        number_of_episodes: 2,
        last_episode_to_air: { runtime: 0 },
        next_episode_to_air: { runtime: 11 },
      }),
    ).toBe(22);
    expect(showTotalMinutes({ number_of_episodes: 2, last_episode_to_air: { runtime: 10 } }, 99)).toBe(20);
  });

  it("accepts a trimmed title and rejects blank or oversized titles", () => {
    expect(requireTitle("  It  ")).toBe("It");
    expect(requireTitle("a")).toBe("a");
    expect(requireTitle("a".repeat(200))).toBe("a".repeat(200));
    expect(() => requireTitle(null)).toThrow(HttpError);
    expect(() => requireTitle("   ")).toThrow(HttpError);
    expect(() => requireTitle("a".repeat(201))).toThrow(HttpError);
  });

  it("trims overviews and caps them at 180 characters", () => {
    expect(trimOverview(null)).toBeUndefined();
    expect(trimOverview("   ")).toBeUndefined();
    expect(trimOverview("A short overview.")).toBe("A short overview.");
    expect(trimOverview("a".repeat(180))).toBe("a".repeat(180));
    expect(trimOverview(`${"b".repeat(160)}${" ".repeat(40)}tail`)).toBe(`${"b".repeat(160)}…`);
    expect(trimOverview("d".repeat(181))?.endsWith("…")).toBe(true);
  });
});

describe("tmdbJson", () => {
  it("requires a TMDb key and requests JSON with the key on either query shape", async () => {
    const urls: string[] = [];
    await expect(withNeonFetch({ TMDBKey: undefined }, () => jsonResponse({}), [], async () => {
      await tmdbJson("/movie/1");
    })).rejects.toMatchObject({ status: 503, message: "TMDBKey is not configured." });

    await expect(withNeonFetch({ TMDBKey: "   " }, () => jsonResponse({}), [], async () => {
      await tmdbJsonOptional("/movie/1");
    })).rejects.toMatchObject({ status: 503 });

    await withNeonFetch({ TMDBKey: "key+" }, (url) => {
      urls.push(url);
      return jsonResponse(url.includes("/search/") ? { results: [] } : { id: 1, title: "It" });
    }, [], async () => {
      await expect(tmdbJson("/movie/1")).resolves.toMatchObject({ title: "It" });
      await expect(tmdbJsonOptional("/search/movie?query=it")).resolves.toEqual({ results: [] });
    });

    expect(urls[0]).toContain("https://api.themoviedb.org/3/movie/1?api_key=key%2B");
    expect(urls[1]).toContain("/search/movie?query=it&api_key=key%2B");
  });

  it("returns null for HTTP failures and network errors, and rethrows auth failures", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ status_message: "no" }, 401), [], async () => {
      await expect(tmdbJsonOptional("/movie/1")).rejects.toMatchObject({ status: 503, message: "Could not reach TMDb." });
      await expect(tmdbJson("/movie/1")).rejects.toMatchObject({ status: 503 });
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ status_message: "no" }, 500), [], async () => {
      await expect(tmdbJsonOptional("/movie/1")).resolves.toBeNull();
      await expect(tmdbJson("/movie/1")).rejects.toMatchObject({ status: 502, message: "Could not reach TMDb." });
    });

    await withNeonFetch({ TMDBKey: "key" }, () => textResponse("not-json", 200), [], async () => {
      await expect(tmdbJsonOptional("/movie/1")).resolves.toEqual({});
    });

    await withNeonFetch({ TMDBKey: "key" }, () => {
      throw new Error("offline");
    }, [], async () => {
      await expect(tmdbJsonOptional("/movie/1")).resolves.toBeNull();
    });
  });
});

describe("collectionIsHorrorAdjacent", () => {
  it("is true when any part has a horror-adjacent genre", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({
      parts: [null, { genre_ids: [18] }, { genre_ids: [27] }],
    }), [], async () => {
      await expect(collectionIsHorrorAdjacent(10)).resolves.toBe(true);
    });
  });

  it("is false when the collection has no horror parts or cannot be loaded", async () => {
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      if (url.includes("/collection/2")) {
        return jsonResponse({ parts: "nope" });
      }

      if (url.includes("/collection/3")) {
        return jsonResponse({}, 500);
      }

      if (url.includes("/collection/4")) {
        throw new Error("offline");
      }

      return jsonResponse({ parts: [{ genre_ids: [18] }] });
    }, [], async () => {
      await expect(collectionIsHorrorAdjacent(1)).resolves.toBe(false);
      await expect(collectionIsHorrorAdjacent(2)).resolves.toBe(false);
      await expect(collectionIsHorrorAdjacent(3)).resolves.toBe(false);
      await expect(collectionIsHorrorAdjacent(4)).resolves.toBe(false);
    });

    await withNeonFetch({ TMDBKey: undefined }, () => jsonResponse({}), [], async () => {
      await expect(collectionIsHorrorAdjacent(5)).resolves.toBe(false);
    });
  });
});
