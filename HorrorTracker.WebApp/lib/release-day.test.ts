import { describe, expect, it, vi } from "vitest";
import { jsonResponse, testConn, withNeonFetch } from "../test-helpers/http";
import * as movies from "./import-tmdb";
import { importFilmsReleasingToday, releaseDay } from "./release-day";

const CONN = testConn("release-day");
const DAY = "2026-11-06";

describe("releaseDay", () => {
  it("uses the Eastern calendar date", () => {
    expect(releaseDay(new Date("2026-11-07T03:00:00.000Z"))).toBe(DAY);
    expect(releaseDay(new Date("2026-11-06T18:00:00.000Z"))).toBe(DAY);
  });
});

describe("importFilmsReleasingToday", () => {
  it("adds new horror films releasing that day and skips ones already in the vault", async () => {
    await withNeonFetch(
      { TMDBKey: "key" },
      (url) => {
        if (url.includes("/discover/movie")) {
          return jsonResponse({
            total_pages: 1,
            results: [
              { id: 11, title: "Kept", release_date: DAY },
              { id: 12, title: "New Night", release_date: DAY },
              { id: 13, title: "   ", release_date: DAY },
              { id: 14, title: "Tomorrow", release_date: "2026-11-07" },
              { id: 11, title: "Kept", release_date: DAY },
            ],
          });
        }

        if (url.includes("/movie/11")) {
          return jsonResponse({ title: "Kept", release_date: "1999-01-01", runtime: 90 });
        }

        if (url.includes("/movie/12")) {
          return jsonResponse({ title: "New Night", release_date: DAY, runtime: 88 });
        }

        if (url.includes("/movie/13")) {
          return jsonResponse({ title: "   " });
        }

        if (url.includes("/keywords")) {
          return jsonResponse({}, 404);
        }

        return jsonResponse({});
      },
      [
        { match: "WHERE tmdbid = $1", rows: [{ id: 4 }], once: true },
        { match: "WHERE tmdbid = $1", rows: [] },
        { match: "lower(title)", rows: [] },
        { match: "INSERT INTO movie", rows: [{ id: 20 }] },
      ],
      async (neon) => {
        await expect(importFilmsReleasingToday(CONN, new Date("2026-11-06T18:00:00.000Z"))).resolves.toEqual({
          date: DAY,
          added: 1,
          already: 1,
          failed: 1,
        });
        expect(neon.calls.find((call) => call.query.includes("INSERT INTO movie"))?.params).toEqual([
          "New Night",
          88,
          false,
          null,
          2026,
        ]);
      },
    );
  });

  it("caps long result lists and keeps going when a release date or failure is not a normal error", async () => {
    const spy = vi.spyOn(movies, "importMovie").mockImplementation(async (_connection, tmdbId) => {
      if (tmdbId === 10) {
        throw "offline";
      }

      return { added: 1, id: `movie:${tmdbId}` };
    });

    try {
      await withNeonFetch(
        { TMDBKey: "key" },
        (url) => {
          if (!url.includes("/discover/movie")) {
            return jsonResponse({});
          }

          if (url.includes("page=2")) {
            return jsonResponse({ results: [{ id: 3, release_date: DAY }] });
          }

          return jsonResponse({
            total_pages: 5,
            results: [{ id: 1, release_date: DAY }, { id: 2 }],
          });
        },
        [],
        async () => {
          await expect(importFilmsReleasingToday(CONN, new Date("2026-11-06T18:00:00.000Z"))).resolves.toEqual({
            date: DAY,
            added: 2,
            already: 0,
            failed: 0,
          });
        },
      );

      await withNeonFetch(
        { TMDBKey: "key" },
        (url) => {
          if (!url.includes("/discover/movie")) {
            return jsonResponse({});
          }

          return jsonResponse({
            total_pages: 1,
            results: Array.from({ length: 25 }, (_, index) => ({ id: 10 + index, release_date: DAY })),
          });
        },
        [],
        async () => {
          await expect(importFilmsReleasingToday(CONN, new Date("2026-11-06T18:00:00.000Z"))).resolves.toEqual({
            date: DAY,
            added: 23,
            already: 0,
            failed: 1,
          });
        },
      );
    } finally {
      spy.mockRestore();
    }
  });
});
