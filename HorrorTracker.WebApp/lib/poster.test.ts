import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, testConn, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import { HttpError } from "./neon";
import {
  ensurePoster,
  ensurePosterSchema,
  fillMissingPosters,
  parsePosterPath,
  posterSize,
  posterUrl,
  postersForCatalogIds,
  postersForRecentProgress,
  proxyTmdbPoster,
  savePoster,
} from "./poster";

afterEach(() => {
  vi.restoreAllMocks();
});

function imageResponse(byteLength: number, ok = true, contentType: string | null = "image/jpeg"): Response {
  const bytes = new Uint8Array(byteLength);
  if (byteLength > 0) {
    bytes[0] = 9;
  }

  return {
    ok,
    status: ok ? 200 : 404,
    headers: { get: () => contentType },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

describe("parsePosterPath", () => {
  it("keeps a TMDb path and drops anything else", () => {
    expect(parsePosterPath("/abc123.jpg")).toBe("/abc123.jpg");
    expect(parsePosterPath("https://image.tmdb.org/t/p/w92/abc123.jpg")).toBeUndefined();
    expect(parsePosterPath("/../secret.jpg")).toBeUndefined();
    expect(parsePosterPath("-")).toBeUndefined();
    expect(parsePosterPath(null)).toBeUndefined();
    expect(parsePosterPath("/a b.jpg")).toBeUndefined();
    expect(parsePosterPath(`/${"a".repeat(159)}`)).toBe(`/${"a".repeat(159)}`);
    expect(parsePosterPath(`/${"a".repeat(160)}`)).toBeUndefined();
  });
});

describe("posterUrl", () => {
  it("builds a TMDb image URL", () => {
    expect(posterUrl("/abc123.jpg")).toBe("https://image.tmdb.org/t/p/w92/abc123.jpg");
    expect(posterUrl("/abc123.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc123.jpg");
    expect(posterUrl(undefined)).toBeUndefined();
  });
});

describe("posterSize", () => {
  it("keeps TMDb thumbnail sizes and defaults the rest", () => {
    expect(posterSize("w780")).toBe("w780");
    expect(posterSize("original")).toBe("w500");
    expect(posterSize(null)).toBe("w500");
    expect(posterSize("w92")).toBe("w92");
    expect(posterSize("w185")).toBe("w185");
    expect(posterSize("w342")).toBe("w342");
    expect(posterSize("w500")).toBe("w500");
  });
});

describe("proxyTmdbPoster", () => {
  it("rejects a path that is not a TMDb file", async () => {
    await expect(proxyTmdbPoster("nope", "w92")).rejects.toMatchObject({ status: 400, message: "That poster was not found." });
    await expect(proxyTmdbPoster(null, "w92")).rejects.toBeInstanceOf(HttpError);
  });

  it("proxies an image and replaces a missing or non-image type", async () => {
    const urls: string[] = [];
    await withNeonFetch({}, (url) => {
      urls.push(url);
      if (url.includes("/w342/")) {
        return imageResponse(4, true, "image/png");
      }

      if (url.includes("/w500/")) {
        return imageResponse(4, true, "text/plain");
      }

      return imageResponse(4, true, null);
    }, [], async () => {
      const png = await proxyTmdbPoster("/abc.jpg", "w342");
      expect(png.headers.get("content-type")).toBe("image/png");
      expect(png.headers.get("cache-control")).toBe("private, max-age=86400");
      expect((await png.arrayBuffer()).byteLength).toBe(4);

      const plain = await proxyTmdbPoster("/abc.jpg", "original");
      expect(plain.headers.get("content-type")).toBe("image/jpeg");

      const missing = await proxyTmdbPoster("/abc.jpg", "w185");
      expect(missing.headers.get("content-type")).toBe("image/jpeg");
    });

    expect(urls).toEqual([
      "https://image.tmdb.org/t/p/w342/abc.jpg",
      "https://image.tmdb.org/t/p/w500/abc.jpg",
      "https://image.tmdb.org/t/p/w185/abc.jpg",
    ]);
  });

  it("rejects responses that are not a usable image", async () => {
    await withNeonFetch({}, () => imageResponse(4, false, "image/jpeg"), [], async () => {
      await expect(proxyTmdbPoster("/abc.jpg", "w92")).rejects.toMatchObject({ status: 404 });
    });

    await withNeonFetch({}, () => imageResponse(0, true, "image/jpeg"), [], async () => {
      await expect(proxyTmdbPoster("/abc.jpg", "w92")).rejects.toMatchObject({ status: 404 });
    });

    await withNeonFetch({}, () => imageResponse(8 * 1024 * 1024 + 1, true, "image/jpeg"), [], async () => {
      await expect(proxyTmdbPoster("/abc.jpg", "w92")).rejects.toMatchObject({ status: 404 });
    });
  });
});

describe("poster schema", () => {
  it("applies the schema once per connection and again for a new one", async () => {
    const first = testConn("poster-schema-a");
    const second = testConn("poster-schema-b");
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await ensurePosterSchema(first);
      const afterFirst = neon.calls.length;
      await ensurePosterSchema(first);
      expect(neon.calls).toHaveLength(afterFirst);
      await ensurePosterSchema(second);
      expect(neon.calls.length).toBeGreaterThan(afterFirst);
    });
  });

  it("clears the cached schema when a required alter fails", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "ALTER TABLE movie ADD COLUMN IF NOT EXISTS posterpath", error: "boom", once: true },
    ], async () => {
      await expect(ensurePosterSchema(testConn("poster-schema-fail"))).rejects.toThrow("boom");
    });
  });

  it("ignores a missing show table", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "ALTER TABLE show ADD COLUMN IF NOT EXISTS posterpath", error: "no show" },
    ], async () => {
      await expect(ensurePosterSchema(testConn("poster-schema-show"))).resolves.toBeUndefined();
    });
  });
});

describe("savePoster", () => {
  it("writes a valid path and ignores values or ids that cannot be stored", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await savePoster(testConn("poster-save"), "movie", 4, "https://example.com/x.jpg");
      expect(neon.calls).toEqual([]);
      await savePoster(testConn("poster-save"), "podcast", 4, "/a.jpg");
      await savePoster(testConn("poster-save"), "movie", 1.5, "/a.jpg");
      await savePoster(testConn("poster-save"), "movie", 0, "/a.jpg");
      expect(neon.calls.some((call) => call.query.includes("UPDATE"))).toBe(false);
      await savePoster(testConn("poster-save"), "series", 2, "/a.jpg");
      expect(neon.calls.some((call) => call.query.includes("UPDATE movieseries SET posterpath") && call.params[0] === "/a.jpg")).toBe(true);
    });
  });
});

describe("fillMissingPosters", () => {
  const rows = [
    { id: 0, tmdbid: 1 },
    { id: 1, tmdbid: 1 },
    { id: 2, tmdbid: 2 },
    { id: 3, tmdbid: 3 },
    { id: 4, tmdbid: 4 },
    { id: 1.5, tmdbid: 1 },
    { id: 5 },
    { id: 6, tmdbid: 0 },
  ];

  function posterApi(url: string): Response {
    const id = url.match(/\/(\d+)\?/)?.[1];
    if (id === "1") {
      return jsonResponse({ poster_path: "/p.jpg" });
    }

    if (id === "2") {
      return jsonResponse({}, 404);
    }

    if (id === "3") {
      return jsonResponse({ poster_path: "not a path" });
    }

    if (id === "4") {
      throw new Error("offline");
    }

    return jsonResponse({}, 404);
  }

  it("fills one poster per kind and records the misses", async () => {
    await withNeonFetch({ TMDBKey: "key" }, posterApi, [
      { match: "user_media_progress", rows },
    ], async () => {
      await expect(fillMissingPosters(testConn("poster-fill"))).resolves.toBe(4);
    });
  });

  it("uses the simpler poster query when progress cannot be read", async () => {
    await withNeonFetch({ TMDBKey: "key" }, posterApi, [
      { match: "user_media_progress", error: "no progress" },
      { match: "SELECT id, tmdbid FROM", rows: [{ id: 1, tmdbid: 1 }] },
    ], async () => {
      await expect(fillMissingPosters(testConn("poster-fill-fallback"), 1_000)).resolves.toBe(4);
    });
  });

  it("returns zero when neither poster query can run", async () => {
    await withNeonFetch({ TMDBKey: "key" }, posterApi, [
      { match: "user_media_progress", error: "no progress" },
      { match: "SELECT id, tmdbid FROM", error: "no table" },
    ], async () => {
      await expect(fillMissingPosters(testConn("poster-fill-empty"), 10_000)).resolves.toBe(0);
    });
  });

  it("ignores a poster lookup when TMDb is not configured", async () => {
    await withNeonFetch({ TMDBKey: undefined }, unreachableNetwork, [
      { match: "user_media_progress", rows: [{ id: 1, tmdbid: 1 }] },
    ], async () => {
      await expect(fillMissingPosters(testConn("poster-fill-nokey"))).resolves.toBe(0);
    });
  });

  it("stops once the time budget is spent", async () => {
    const stamps = [1_000, 1_200, 9_000];
    let index = 0;
    vi.spyOn(Date, "now").mockImplementation(() => stamps[Math.min(index++, stamps.length - 1)] ?? 9_000);
    let tmdbCalls = 0;
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      tmdbCalls += 1;
      return posterApi(url);
    }, [
      { match: "user_media_progress", rows: [{ id: 1, tmdbid: 1 }] },
    ], async (neon) => {
      await expect(fillMissingPosters(testConn("poster-fill-deadline"), 500)).resolves.toBe(0);
      expect(neon.calls.filter((call) => call.query.includes("user_media_progress"))).toHaveLength(1);
      expect(tmdbCalls).toBe(0);
    });
  });
});

describe("ensurePoster", () => {
  it("returns without a query for series, unknown kinds, and bad ids", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await expect(ensurePoster(testConn("poster-guard"), "series", 1)).resolves.toBeUndefined();
      await expect(ensurePoster(testConn("poster-guard"), "podcast", 1)).resolves.toBeUndefined();
      await expect(ensurePoster(testConn("poster-guard"), "movie", 0)).resolves.toBeUndefined();
      await expect(ensurePoster(testConn("poster-guard"), "movie", 1.5)).resolves.toBeUndefined();
      expect(neon.calls).toEqual([]);
    });
  });

  it("returns a poster that is already stored", async () => {
    await withNeonFetch({ TMDBKey: "key" }, unreachableNetwork, [
      { match: "SELECT tmdbid, posterpath FROM movie", rows: [{ tmdbid: 3, posterpath: "/has.jpg" }] },
    ], async () => {
      await expect(ensurePoster(testConn("poster-existing"), "movie", 3)).resolves.toBe("/has.jpg");
    });
  });

  it("loads a poster from TMDb and falls back to a sibling or nothing", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ poster_path: "/from-tmdb.jpg" }), [
      { match: "SELECT tmdbid, posterpath FROM movie", rows: [{ tmdbid: 9, posterpath: null }] },
    ], async (neon) => {
      await expect(ensurePoster(testConn("poster-tmdb"), "movie", 9)).resolves.toBe("/from-tmdb.jpg");
      expect(neon.calls.some((call) => call.query.includes("NULLIF(ms.posterpath"))).toBe(false);
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({}, 404), [
      { match: "SELECT tmdbid, posterpath FROM movie", rows: [{ tmdbid: 9, posterpath: "-" }] },
      { match: "NULLIF(ms.posterpath", rows: [{ posterpath: "/sib.jpg" }] },
    ], async () => {
      await expect(ensurePoster(testConn("poster-sibling"), "movie", 9)).resolves.toBe("/sib.jpg");
    });

    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({ poster_path: "nope" }), [
      { match: "SELECT tmdbid, posterpath FROM movie", rows: [{ posterpath: null }] },
      { match: "NULLIF(ms.posterpath", rows: [{ posterpath: "nope" }] },
    ], async () => {
      await expect(ensurePoster(testConn("poster-none"), "movie", 9)).resolves.toBeUndefined();
    });

    await withNeonFetch({ TMDBKey: "key" }, unreachableNetwork, [
      { match: "SELECT tmdbid, posterpath FROM documentary", rows: [{}] },
    ], async (neon) => {
      await expect(ensurePoster(testConn("poster-doc"), "documentary", 2)).resolves.toBeUndefined();
      expect(neon.calls.some((call) => call.query.includes("NULLIF(ms.posterpath"))).toBe(false);
    });
  });

  it("returns undefined when the lookup fails", async () => {
    await withNeonFetch({ TMDBKey: "key" }, unreachableNetwork, [
      { match: "SELECT tmdbid, posterpath FROM show", error: "missing show" },
    ], async () => {
      await expect(ensurePoster(testConn("poster-show-missing"), "show", 2)).resolves.toBeUndefined();
    });

    await withNeonFetch({ TMDBKey: "key" }, unreachableNetwork, [
      { match: "SELECT tmdbid, posterpath FROM movie", rows: [{ posterpath: null }] },
      { match: "NULLIF(ms.posterpath", error: "no join" },
    ], async () => {
      await expect(ensurePoster(testConn("poster-sibling-fail"), "movie", 2)).resolves.toBeUndefined();
    });

    await withNeonFetch({ TMDBKey: undefined }, unreachableNetwork, [
      { match: "SELECT tmdbid, posterpath FROM movie", rows: [{ tmdbid: 4, posterpath: null }] },
    ], async () => {
      await expect(ensurePoster(testConn("poster-no-key"), "movie", 4)).resolves.toBeUndefined();
    });
  });
});

describe("home posters", () => {
  it("ignores anonymous users and database errors", async () => {
    await expect(postersForRecentProgress(testConn("poster-recent"), 0)).resolves.toEqual({});
    await expect(postersForRecentProgress(testConn("poster-recent"), -2)).resolves.toEqual({});
    await expect(postersForRecentProgress(testConn("poster-recent"), 1.5)).resolves.toEqual({});
    await withNeonFetch({}, unreachableNetwork, [
      { match: "LIMIT 8", error: "missing" },
    ], async () => {
      await expect(postersForRecentProgress(testConn("poster-recent-error"), 4)).resolves.toEqual({});
    });
  });

  it("loads posters for the ids returned by recent progress", async () => {
    await withNeonFetch({}, unreachableNetwork, [
      { match: "LIMIT 8", rows: [{ media_kind: "movie", media_id: 4 }, { media_kind: "show", media_id: 8 }] },
      { match: "FROM movie", rows: [{ posterpath: "/m.jpg" }] },
      { match: "FROM show", rows: [{ posterpath: "/s.jpg" }] },
    ], async () => {
      await expect(postersForRecentProgress(testConn("poster-recent-rows"), 4)).resolves.toEqual({
        "movie:4": "/m.jpg",
        "show:8": "/s.jpg",
      });
    });
  });

  it("dedupes catalog ids and skips values that are not posters", async () => {
    await expect(postersForCatalogIds(testConn("poster-ids"), [])).resolves.toEqual({});
    await expect(postersForCatalogIds(testConn("poster-ids"), ["movie", "show"])).resolves.toEqual({});
    await withNeonFetch({ TMDBKey: "key" }, () => jsonResponse({}, 404), [
      { match: "FROM movie", rows: [{ posterpath: "/m.jpg" }] },
      { match: "FROM show", rows: [{ posterpath: null }] },
    ], async () => {
      await expect(postersForCatalogIds(testConn("poster-ids-rows"), ["movie:4", "movie:4", "nope", "show:3"])).resolves.toEqual({
        "movie:4": "/m.jpg",
      });
    });
  });

  it("stops before fetching when the budget is already spent", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    let called = false;
    await withNeonFetch({}, () => {
      called = true;
      return jsonResponse({});
    }, [], async (neon) => {
      await expect(postersForCatalogIds(testConn("poster-ids-budget"), ["movie:1"], 0)).resolves.toEqual({});
      expect(neon.calls.some((call) => call.query.includes("FROM movie"))).toBe(false);
      expect(called).toBe(false);
    });
  });
});
