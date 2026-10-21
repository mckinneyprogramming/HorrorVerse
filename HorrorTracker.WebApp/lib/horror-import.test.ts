import { describe, expect, it } from "vitest";
import type { NeonMock, NeonStep } from "../test-helpers/neon";
import { jsonResponse, testConn, withNeonFetch } from "../test-helpers/http";
import { filmWindows, importHorrorBatch, nextFilmCursor, type HorrorImportProgress } from "./horror-import";

const CONN = testConn("horror-import");

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

  it("stops at the discover page cap and restarts when the year is unknown", () => {
    expect(nextFilmCursor({ fromYear: 1895, page: 500, index: 0, done: false }, 1, 600, 1, windows)).toEqual({
      fromYear: 1900,
      page: 1,
      index: 0,
      done: false,
    });
    expect(nextFilmCursor({ fromYear: 1, page: 1, index: 3, done: false }, 1, 1, 4, [{ fromYear: 1895 }])).toEqual({
      fromYear: 1895,
      page: 1,
      index: 0,
      done: false,
    });
    expect(nextFilmCursor({ fromYear: 1, page: 1, index: 0, done: false }, 1, 1, 1, []).done).toBe(true);
  });
});

function savedCursor(neon: NeonMock): { cursor: Record<string, unknown>; added: unknown; skipped: unknown } {
  const call = neon.calls.find((item) => item.query.includes("INSERT INTO catalog_import"));
  if (!call) {
    throw new Error("cursor was not saved");
  }

  return {
    cursor: JSON.parse(String(call.params[1])) as Record<string, unknown>,
    added: call.params[2],
    skipped: call.params[3],
  };
}

async function runFilms(options: {
  row?: Record<string, unknown>;
  missingRow?: boolean;
  discover?: Record<string, unknown>;
  movies?: Record<string, Response>;
  count?: number;
  extra?: NeonStep[];
}): Promise<{ progress: HorrorImportProgress; urls: string[]; neon: NeonMock }> {
  const urls: string[] = [];
  let progress: HorrorImportProgress | undefined;
  let neonResult: NeonMock | undefined;
  await withNeonFetch({ TMDBKey: "key" }, (url) => {
    urls.push(url);
    if (url.includes("/discover/")) {
      return jsonResponse(options.discover ?? { results: [], total_pages: 1 });
    }

    if (url.includes("/keywords")) {
      return jsonResponse({}, 404);
    }

    const id = url.match(/\/movie\/(\d+)/)?.[1] ?? "";
    return options.movies?.[id] ?? jsonResponse({ title: "Imported", release_date: "1990-01-01", runtime: 80, poster_path: "/p.jpg" });
  }, [
    ...(options.missingRow
      ? []
      : [{
          match: "FROM catalog_import WHERE id",
          rows: [options.row ?? { cursor: { fromYear: 1895, page: 1, index: 0, done: false }, added: 0, skipped: 0 }],
        }]),
    ...(options.count === undefined ? [] : [{ match: "SELECT COUNT", rows: [{ count: options.count }] }]),
    ...(options.extra ?? []),
  ], async (neon) => {
    neonResult = neon;
    progress = await importHorrorBatch(CONN, "horror-films");
  });

  return { progress: progress!, urls, neon: neonResult! };
}

async function runCollections(options: {
  row?: Record<string, unknown>;
  missingRow?: boolean;
  queue?: Record<string, unknown>[];
  count?: number;
  collections?: Record<string, unknown>;
  extra?: NeonStep[];
}): Promise<{ progress: HorrorImportProgress; neon: NeonMock }> {
  let progress: HorrorImportProgress | undefined;
  let neonResult: NeonMock | undefined;
  await withNeonFetch({ TMDBKey: "key" }, (url) => {
    const id = url.match(/\/collection\/(\d+)/)?.[1];
    if (id && options.collections?.[id]) {
      return jsonResponse(options.collections[id]);
    }

    if (url.includes("/keywords")) {
      return jsonResponse({}, 404);
    }

    if (url.includes("/movie/")) {
      return jsonResponse({ title: "Film", release_date: "1990-01-01", runtime: 90, poster_path: "/f.jpg" });
    }

    return jsonResponse({ name: "Fallback", parts: [] });
  }, [
    ...(options.missingRow
      ? []
      : [{
          match: "FROM catalog_import WHERE id",
          rows: [options.row ?? { cursor: {}, added: 0, skipped: 0 }],
        }]),
    { match: "SELECT tmdbid", rows: options.queue ?? [] },
    ...(options.count === undefined ? [] : [{ match: "SELECT COUNT", rows: [{ count: options.count }] }]),
    ...(options.extra ?? []),
  ], async (neon) => {
    neonResult = neon;
    progress = await importHorrorBatch(CONN, "horror-collections");
  });

  return { progress: progress!, neon: neonResult! };
}

describe("importHorrorBatch films", () => {
  it("imports new films, skips documentaries, existing rows, and failures", async () => {
    const { progress, neon } = await runFilms({
      row: { cursor: { fromYear: 1895, page: 1, index: 0, done: false }, added: 4, skipped: 0 },
      count: 2,
      discover: {
        total_pages: 3,
        results: [
          { id: 1, genre_ids: [99, 27], title: "Doc" },
          { genre_ids: [27], title: "No id" },
          { id: 201, genre_ids: [27], title: "New" },
          { id: 202, genre_ids: [27], title: "Old" },
          { id: 203, genre_ids: [27], title: "Boom" },
        ],
      },
      movies: {
        203: jsonResponse({}, 500),
      },
      extra: [
        { match: "WHERE tmdbid = $1", rows: [], once: true },
        { match: "WHERE lower(title) = lower($1) AND releaseyear", rows: [], once: true },
        { match: "INSERT INTO movie", rows: [{ id: 55 }], once: true },
        { match: "WHERE tmdbid = $1", rows: [{ id: 8 }], once: true },
      ],
    });

    expect(progress).toMatchObject({
      import: "horror-films",
      done: false,
      added: 5,
      skipped: 3,
      batchAdded: 1,
      batchSkipped: 3,
      queued: 2,
    });
    expect(progress.label).toContain("1895");
    expect(savedCursor(neon).cursor).toMatchObject({ fromYear: 1895, page: 2, index: 0, done: false });
  });

  it("resets a finished cursor and a cursor that cannot be parsed", async () => {
    const finished = await runFilms({
      row: { cursor: { fromYear: 2025, page: 9, index: 4, done: true }, added: 1, skipped: 1 },
      discover: { results: [], total_pages: 0 },
    });
    expect(finished.urls.some((url) => url.includes("page=1") && url.includes("primary_release_date.gte=1895-01-01"))).toBe(true);
    expect(finished.urls.some((url) => url.includes("page=9"))).toBe(false);

    const invalidYear = await runFilms({
      row: { cursor: { fromYear: 1800, page: 4, index: 2, done: false }, added: 0, skipped: 3 },
      discover: { results: [] },
    });
    expect(invalidYear.urls.some((url) => url.includes("page=1") && url.includes("gte=1895-01-01"))).toBe(true);

    const invalidPage = await runFilms({
      row: { cursor: { fromYear: 1895, page: 0, index: 2, done: false }, added: "nope", skipped: "nope" },
    });
    expect(invalidPage.urls.some((url) => url.includes("page=1"))).toBe(true);
    expect(invalidPage.progress.added).toBe(0);
    expect(invalidPage.progress.skipped).toBe(0);

    const fractionalPage = await runFilms({
      row: { cursor: { fromYear: 1895, page: 2.5, index: 1, done: false }, added: 0, skipped: 0 },
    });
    expect(fractionalPage.urls.some((url) => url.includes("page=1"))).toBe(true);
  });

  it("keeps a valid page and index, including string and fractional indexes", async () => {
    const kept = await runFilms({
      row: { cursor: { fromYear: 1895, page: 2, index: 4, done: false }, added: 4, skipped: 0 },
      discover: { results: [], total_pages: 5 },
      count: 0,
    });
    expect(kept.urls.some((url) => url.includes("page=2"))).toBe(true);
    expect(savedCursor(kept.neon).cursor).toMatchObject({ page: 3, index: 0, fromYear: 1895 });

    const zeroIndex = await runFilms({
      row: { cursor: { fromYear: 1895, page: 2, index: 0, done: false }, added: 0, skipped: 4 },
      discover: { results: [], total_pages: 5 },
    });
    expect(savedCursor(zeroIndex.neon).cursor).toMatchObject({ page: 3 });

    const fractionalIndex = await runFilms({
      row: { cursor: JSON.stringify({ fromYear: 1895, page: 2, index: 1.5, done: false }), added: 2, skipped: 2 },
      discover: { results: [], total_pages: 5 },
    });
    expect(fractionalIndex.urls.some((url) => url.includes("page=2"))).toBe(true);

    const negativeIndex = await runFilms({
      row: { cursor: { fromYear: 1895, page: 2, index: -2, done: false }, added: 0, skipped: 0 },
      discover: { results: [], total_pages: 5 },
    });
    expect(negativeIndex.urls.some((url) => url.includes("page=2"))).toBe(true);
  });

  it("finishes on the last window once the capped page is consumed", async () => {
    const last = filmWindows().at(-1);
    if (!last) {
      throw new Error("expected a film window");
    }

    const { progress, urls } = await runFilms({
      row: { cursor: { fromYear: last.fromYear, page: 500, index: 0, done: false }, added: 0, skipped: 0 },
      discover: { results: [], total_pages: 9000 },
      count: 5,
    });
    expect(progress.done).toBe(true);
    expect(progress.label).toBe("Horror films are imported.");
    expect(progress.queued).toBe(5);
    expect(urls.some((url) => url.includes(`page=500`) && url.includes(last.from))).toBe(true);
  });

  it("starts from the first window when no cursor row exists", async () => {
    const { progress, urls } = await runFilms({ missingRow: true, discover: { results: [], total_pages: 1 } });
    expect(progress.added).toBe(0);
    expect(progress.skipped).toBe(0);
    expect(progress.queued).toBe(0);
    expect(urls.some((url) => url.includes("gte=1895-01-01"))).toBe(true);
  });
});

describe("importHorrorBatch collections", () => {
  it("skips ids that are not horror and failures, and uses the singular label", async () => {
    const { progress } = await runCollections({
      row: { cursor: { done: false }, added: 2, skipped: 3 },
      queue: [{ tmdbid: null }, { tmdbid: 10 }, { tmdbid: 13 }, { nope: true }],
      count: 1,
      collections: {
        10: { parts: [{ genre_ids: [18] }] },
        13: { name: "   ", parts: [{ genre_ids: [27] }] },
      },
    });

    expect(progress).toMatchObject({
      import: "horror-collections",
      done: false,
      added: 2,
      skipped: 5,
      batchAdded: 0,
      batchSkipped: 2,
      queued: 1,
      label: "1 collection still queued.",
    });
  });

  it("adds a new horror series and finishes the queue", async () => {
    const { progress } = await runCollections({
      row: { cursor: {}, added: 0, skipped: 0 },
      queue: [{ tmdbid: 11 }],
      count: 0,
      collections: {
        11: { name: "Candyman", poster_path: "/c.jpg", parts: [{ genre_ids: [27] }] },
      },
      extra: [{ match: "INSERT INTO movieseries", rows: [{ id: 12 }] }],
    });

    expect(progress).toMatchObject({
      done: true,
      added: 1,
      batchAdded: 1,
      batchSkipped: 0,
      queued: 0,
      label: "Horror collections are imported.",
    });
    expect(progress.import).toBe("horror-collections");
  });

  it("counts an existing series as skipped and pluralizes the remaining label", async () => {
    const { progress } = await runCollections({
      queue: [{ tmdbid: 12 }],
      count: 2,
      collections: {
        12: { name: "Saw", parts: [{ genre_ids: [53] }] },
      },
      extra: [{ match: "FROM movieseries WHERE lower(title)", rows: [{ id: 3 }] }],
    });

    expect(progress).toMatchObject({
      done: false,
      batchAdded: 0,
      batchSkipped: 1,
      queued: 2,
      label: "2 collections still queued.",
    });
  });

  it("accepts every stored cursor shape", async () => {
    const shapes: unknown[] = [
      "nope",
      "[]",
      "null",
      "5",
      "{\"fromYear\":1895}",
      [1],
      5,
      null,
      { fromYear: 1895 },
    ];

    for (const cursor of shapes) {
      const { progress } = await runCollections({
        row: { cursor: cursor as never, added: cursor === null ? undefined : 0, skipped: 2 },
        queue: [],
        count: 0,
      });
      expect(progress.done).toBe(true);
      expect(progress.skipped).toBe(2);
    }

    const missing = await runCollections({ missingRow: true, queue: [], count: 0 });
    expect(missing.progress.added).toBe(0);
    expect(missing.progress.done).toBe(true);

    const numbers = await runCollections({
      row: { cursor: "not-json", added: 4, skipped: 0 },
      queue: [],
      count: 5,
    });
    expect(numbers.progress.added).toBe(4);
    expect(numbers.progress.queued).toBe(5);
  });
});
