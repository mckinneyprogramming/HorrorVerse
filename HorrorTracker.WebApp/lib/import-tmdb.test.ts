import { describe, expect, it } from "vitest";
import { jsonResponse, testConn, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import { ensureImportSchema, importMovie, importSeries, queueHorrorCollection } from "./import-tmdb";

const CONN = testConn("import-tmdb");

function movieApi(body: unknown, status = 200) {
  return (url: string) => {
    if (url.includes("/keywords")) {
      return jsonResponse({}, 404);
    }

    return jsonResponse(body, status);
  };
}

function seriesApi(collection: unknown, movies: Record<string, unknown> = {}) {
  return (url: string) => {
    if (url.includes("/keywords")) {
      return jsonResponse({}, 404);
    }

    if (url.includes("/collection/")) {
      return jsonResponse(collection);
    }

    const id = url.match(/\/movie\/(\d+)/)?.[1] ?? "";
    return jsonResponse(movies[id] ?? { title: "Film", release_date: "2000-01-01", runtime: 90, poster_path: "/a.jpg" });
  };
}

describe("queueHorrorCollection", () => {
  it("ignores ids that are not positive integers", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await queueHorrorCollection(CONN, 0);
      await queueHorrorCollection(CONN, -4);
      await queueHorrorCollection(CONN, 1.5);
      expect(neon.calls).toEqual([]);
    });
  });

  it("queues a collection id", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await ensureImportSchema(CONN);
      await queueHorrorCollection(CONN, 8);
      expect(neon.calls.some((call) => call.query.includes("CREATE TABLE IF NOT EXISTS catalog_import"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO catalog_import_collection") && call.params[0] === 8)).toBe(true);
    });
  });
});

describe("importMovie", () => {
  it("rejects a movie TMDb cannot title", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({ title: "   " }), [], async (neon) => {
      await expect(importMovie(CONN, 1)).rejects.toMatchObject({ status: 400, message: "TMDb did not return a usable title." });
      expect(neon.calls).toEqual([]);
    });
  });

  it("inserts a dated movie that is not part of a collection", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({
      title: " It ",
      release_date: "1990-05-01",
      runtime: 96,
      poster_path: "/it.jpg",
    }), [
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 15 }] },
    ], async (neon) => {
      await expect(importMovie(CONN, 15)).resolves.toEqual({ added: 1, id: "movie:15" });
      expect(neon.calls.find((call) => call.query.includes("INSERT INTO movie"))?.params).toEqual(["It", 96, false, null, 1990]);
      expect(neon.calls.some((call) => call.query.includes("FROM movieseries"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("catalog_import_collection"))).toBe(false);
    });
  });

  it("throws when the insert does not return an id and stores a yearless movie as zero", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({ title: "It" }), [], async (neon) => {
      await expect(importMovie(CONN, 3)).rejects.toMatchObject({ status: 500, message: "Could not save that movie." });
      expect(neon.calls.find((call) => call.query.includes("INSERT INTO movie"))?.params).toEqual(["It", 0, false, null, 0]);
    });
  });

  it("queues a collection and links a new movie to its series", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({
      title: "Halloween",
      release_date: "1978-10-25",
      runtime: 91,
      poster_path: "/h.jpg",
      belongs_to_collection: { id: 77, name: "Halloween Collection" },
    }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 3 }] },
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 21 }] },
    ], async (neon) => {
      await expect(importMovie(CONN, 77)).resolves.toEqual({ added: 1, id: "movie:21" });
      expect(neon.calls.find((call) => call.query.includes("INSERT INTO movie"))?.params).toEqual(["Halloween", 91, true, 3, 1978]);
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO catalog_import_collection") && call.params[0] === 77)).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("franchise_item"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("DELETE FROM user_media_progress"))).toBe(true);
    });
  });

  it("still saves the movie when series progress cannot be cleared", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({
      title: "Halloween",
      release_date: "1978-10-25",
      runtime: 91,
      belongs_to_collection: { id: 77, name: "Halloween Collection" },
    }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 3 }] },
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 22 }] },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'series'", error: "missing" },
    ], async () => {
      await expect(importMovie(CONN, 78)).resolves.toEqual({ added: 1, id: "movie:22" });
    });
  });

  it("queues a nameless collection without attaching a series", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({
      title: "Alone",
      release_date: "2000-01-01",
      runtime: 10,
      belongs_to_collection: { id: 5 },
    }), [
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 30 }] },
    ], async (neon) => {
      await expect(importMovie(CONN, 5)).resolves.toEqual({ added: 1, id: "movie:30" });
      expect(neon.calls.some((call) => call.query.includes("FROM movieseries"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(false);
      expect(neon.calls.find((call) => call.query.includes("INSERT INTO movie"))?.params[3]).toBeNull();
    });
  });

  it("names a collection that is not in the catalog yet", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({
      title: "Saw",
      release_date: "2004-01-01",
      runtime: 100,
      belongs_to_collection: { name: "Saw Collection" },
    }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [] },
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 31 }] },
    ], async (neon) => {
      await expect(importMovie(CONN, 6)).resolves.toEqual({ added: 1, id: "movie:31" });
      expect(neon.calls.some((call) => call.query.includes("FROM movieseries WHERE lower(title)"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("catalog_import_collection"))).toBe(false);
    });
  });

  it("returns an existing movie and can attach it to a series", async () => {
    await withNeonFetch({ TMDBKey: "key" }, movieApi({ title: "Old", runtime: 80 }), [
      { match: "WHERE tmdbid = $1", rows: [{ id: 8 }] },
    ], async (neon) => {
      await expect(importMovie(CONN, 8)).resolves.toEqual({ added: 0, id: "movie:8" });
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO movie"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(false);
    });

    await withNeonFetch({ TMDBKey: "key" }, movieApi({
      title: "Halloween",
      release_date: "1978-10-25",
      runtime: 91,
      belongs_to_collection: { id: 77, name: "Halloween Collection" },
    }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 3 }] },
      { match: "WHERE tmdbid = $1", rows: [{ id: 8 }] },
    ], async (neon) => {
      await expect(importMovie(CONN, 9)).resolves.toEqual({ added: 0, id: "movie:8" });
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("franchise_item"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO movie"))).toBe(false);
    });
  });
});

describe("importSeries", () => {
  it("rejects a collection without a title", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi({ name: "   ", parts: [] }), [], async (neon) => {
      await expect(importSeries(CONN, 1)).rejects.toMatchObject({ status: 400, message: "TMDb did not return a usable title." });
      expect(neon.calls).toEqual([]);
    });

    await withNeonFetch({ TMDBKey: "key" }, seriesApi({ parts: [] }), [], async (neon) => {
      await expect(importSeries(CONN, 1)).rejects.toMatchObject({ status: 400, message: "TMDb did not return a usable title." });
      expect(neon.calls).toEqual([]);
    });
  });

  it("creates a series when the title is new", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi({ name: "Saw Collection", poster_path: "/s.jpg", parts: [] }), [
      { match: "INSERT INTO movieseries", rows: [{ id: 6 }] },
    ], async (neon) => {
      await expect(importSeries(CONN, 6)).resolves.toEqual({ added: 1, id: "series:6" });
      expect(neon.calls.some((call) => call.query.includes("UPDATE movieseries SET tmdbid"))).toBe(true);
    });
  });

  it("throws when the series insert does not return an id", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi({ name: "Saw", parts: [] }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [] },
    ], async () => {
      await expect(importSeries(CONN, 6)).rejects.toMatchObject({ status: 500, message: "Could not save that series." });
    });
  });

  it("updates an existing series and keeps going when the tmdb id column cannot be added", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi({ name: "Saw", poster_path: "/s.jpg", parts: [] }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
    ], async () => {
      await expect(importSeries(CONN, 4)).resolves.toEqual({ added: 0, id: "series:4" });
    });

    await withNeonFetch({ TMDBKey: "key" }, seriesApi({ name: "Saw", parts: [] }), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
      { match: "ALTER TABLE movieseries ADD COLUMN IF NOT EXISTS tmdbid", error: "old catalog" },
    ], async () => {
      await expect(importSeries(CONN, 4)).resolves.toEqual({ added: 0, id: "series:4" });
    });
  });

  it("links an existing film and skips keyword work when tags are already stored", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi(
      { name: "Evil Dead Collection", parts: [{ id: 50, release_date: "2000-01-01" }] },
      { 50: { title: "One", release_date: "2000-01-01", runtime: 90, poster_path: "/one.jpg" } },
    ), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
      { match: "WHERE tmdbid = $1", rows: [{ id: 9 }] },
      { match: "AS present", rows: [{ present: 1 }] },
    ], async (neon) => {
      await expect(importSeries(CONN, 50)).resolves.toEqual({ added: 0, id: "series:4" });
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO movie"))).toBe(false);
      expect(neon.calls.some((call) => call.query.includes("UPDATE movie SET partofseries"))).toBe(true);
    });
  });

  it("fetches keywords for an existing film that has none", async () => {
    const urls: string[] = [];
    await withNeonFetch({ TMDBKey: "key" }, (url) => {
      urls.push(url);
      return seriesApi(
        { name: "Evil Dead Collection", parts: [{ id: 51, release_date: "2001-01-01" }] },
        { 51: { title: "Two", release_date: "2001-01-01", runtime: 80, poster_path: "/two.jpg" } },
      )(url);
    }, [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
      { match: "WHERE tmdbid = $1", rows: [{ id: 10 }] },
      { match: "AS present", rows: [] },
    ], async () => {
      await expect(importSeries(CONN, 51)).resolves.toEqual({ added: 0, id: "series:4" });
      expect(urls.some((url) => url.includes("/movie/51/keywords"))).toBe(true);
    });
  });

  it("adds a new film onto the series", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi(
      { name: "Evil Dead Collection", parts: [{ id: 52, release_date: "2002-01-01" }] },
      { 52: { title: "Three", release_date: "2002-01-01", runtime: 70, poster_path: "/three.jpg" } },
    ), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 30 }] },
    ], async (neon) => {
      await expect(importSeries(CONN, 52)).resolves.toEqual({ added: 1, id: "series:4" });
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("DELETE FROM user_media_progress"))).toBe(true);
    });
  });

  it("counts a film even when it cannot be inserted or progress cannot be cleared", async () => {
    await withNeonFetch({ TMDBKey: "key" }, seriesApi(
      { name: "Evil Dead Collection", parts: [{ id: 53, release_date: "2003-01-01" }] },
      { 53: { title: "Four", release_date: "2003-01-01", runtime: 70 } },
    ), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [] },
    ], async (neon) => {
      await expect(importSeries(CONN, 53)).resolves.toEqual({ added: 1, id: "series:4" });
      expect(neon.calls.some((call) => call.query.includes("user_list_item"))).toBe(false);
    });

    await withNeonFetch({ TMDBKey: "key" }, seriesApi(
      { name: "Evil Dead Collection", parts: [{ id: 54, release_date: "2004-01-01" }] },
      { 54: { title: "Five", release_date: "2004-01-01", runtime: 70 } },
    ), [
      { match: "FROM movieseries WHERE lower(title)", rows: [{ id: 4 }] },
      { match: "WHERE tmdbid = $1", rows: [] },
      { match: "INSERT INTO movie", rows: [{ id: 40 }] },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'series'", error: "missing" },
    ], async () => {
      await expect(importSeries(CONN, 54)).resolves.toEqual({ added: 1, id: "series:4" });
    });
  });
});
