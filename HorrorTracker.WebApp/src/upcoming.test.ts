import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUpcoming } from "./upcoming";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUpcoming", () => {
  it("keeps dated films, shows, and episodes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          films: [
            {
              tmdbId: 10,
              title: " Scream 7 ",
              releaseDate: "2026-02-27",
              kind: "film",
              year: 2026,
              overview: " Ghostface ",
              detail: " Sequel ",
              posterPath: "/scream.jpg",
            },
            { tmdbId: 11, title: "Series", releaseDate: "2026-03-01", kind: "SHOW" },
            { tmdbId: 12, title: "Pilot", releaseDate: "2026-04-01", kind: "episode", year: 1888 },
            { tmdbId: 13, title: "Nope", releaseDate: "2026-05-01", kind: "special" },
            { TmdbId: 14, Title: "Pascal", ReleaseDate: "1888-01-02", Kind: "Film", Year: 1888, Overview: "Old", Detail: "Cut", PosterPath: "/old.jpg" },
            { tmdbId: 15, title: "Undated year", releaseDate: "1887-01-01", year: 1887 },
            { tmdbId: 16, title: "Fraction", releaseDate: "2026-06-01", year: 2026.5 },
            { tmdbId: 0, title: "Zero", releaseDate: "2026-01-01" },
            { tmdbId: 1.5, title: "Frac", releaseDate: "2026-01-01" },
            { tmdbId: 17, title: "   ", releaseDate: "2026-01-01" },
            { tmdbId: 18, title: "Bad date", releaseDate: "2026/01/01" },
            { tmdbId: 19, title: "Blank extras", releaseDate: "2026-07-01", overview: "  ", detail: " ", posterPath: "nope" },
            { tmdbId: 30 },
            null,
            "bad",
          ],
          shows: [
            { tmdbId: 20, title: "Loose", releaseDate: "2026-08-01", kind: "special" },
            { tmdbId: 21, title: "Hour", releaseDate: "2026-09-01", Kind: "Show" },
            { tmdbId: 22, title: "Bare", releaseDate: "2026-10-01" },
          ],
        }),
      ),
    );

    await expect(fetchUpcoming()).resolves.toEqual({
      films: [
        {
          kind: "film",
          tmdbId: 10,
          title: "Scream 7",
          releaseDate: "2026-02-27",
          year: 2026,
          overview: "Ghostface",
          detail: "Sequel",
          posterPath: "/scream.jpg",
        },
        { kind: "show", tmdbId: 11, title: "Series", releaseDate: "2026-03-01", year: 2026 },
        { kind: "episode", tmdbId: 12, title: "Pilot", releaseDate: "2026-04-01", year: 1888 },
        { kind: "film", tmdbId: 13, title: "Nope", releaseDate: "2026-05-01", year: 2026 },
        {
          kind: "film",
          tmdbId: 14,
          title: "Pascal",
          releaseDate: "1888-01-02",
          year: 1888,
          overview: "Old",
          detail: "Cut",
          posterPath: "/old.jpg",
        },
        { kind: "film", tmdbId: 15, title: "Undated year", releaseDate: "1887-01-01" },
        { kind: "film", tmdbId: 16, title: "Fraction", releaseDate: "2026-06-01" },
        { kind: "film", tmdbId: 19, title: "Blank extras", releaseDate: "2026-07-01", year: 2026 },
      ],
      shows: [
        { kind: "film", tmdbId: 20, title: "Loose", releaseDate: "2026-08-01", year: 2026 },
        { kind: "show", tmdbId: 21, title: "Hour", releaseDate: "2026-09-01", year: 2026 },
        { kind: "film", tmdbId: 22, title: "Bare", releaseDate: "2026-10-01", year: 2026 },
      ],
    });
  });

  it("returns empty lists when the payload is not a schedule", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ films: "nope", shows: null })));
    await expect(fetchUpcoming()).resolves.toEqual({ films: [], shows: [] });

    vi.stubGlobal("fetch", vi.fn(async () => json({})));
    await expect(fetchUpcoming()).resolves.toEqual({ films: [], shows: [] });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(fetchUpcoming()).resolves.toEqual({ films: [], shows: [] });
  });

  it("raises server errors and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Down" }, 503)));
    await expect(fetchUpcoming()).rejects.toThrow("Down");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(fetchUpcoming()).rejects.toThrow("Upcoming titles failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(fetchUpcoming()).rejects.toThrow("Upcoming titles failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchUpcoming()).rejects.toThrow("offline");
  });
});
