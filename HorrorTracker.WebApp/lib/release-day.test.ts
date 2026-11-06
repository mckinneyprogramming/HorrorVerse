import { describe, expect, it } from "vitest";
import { jsonResponse, testConn, withNeonFetch } from "../test-helpers/http";
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
});
