import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installApi, readBody, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  vi.resetModules();
});

afterEach(() => {
  handle?.restore();
  handle = undefined;
  vi.useRealTimers();
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const today = "2026-06-15";

function films() {
  return {
    total_pages: 20,
    results: [
      null,
      { id: 1.5, title: "Half", release_date: today },
      { id: 0, title: "Zero", release_date: today },
      { id: 1, title: "", release_date: today },
      { id: 2, title: "No Date", release_date: "" },
      { id: 3, title: "Past", release_date: "2026-06-14" },
      { id: 4, title: "Far", release_date: "2028-06-16" },
      { id: 5, title: "Bad", release_date: "yesterday" },
      { id: 6, title: "Bram", release_date: today, overview: "", poster_path: "nope" },
      { id: 6, title: "Bram Again", release_date: today },
      { id: 7, title: "Ada", release_date: today, overview: "x".repeat(450), poster_path: "/ada.jpg" },
      { id: 8, title: "Later", release_date: "2026-07-01", overview: "Soon", poster_path: "/later.jpg" },
    ],
  };
}

function premieres() {
  return {
    total_pages: 0,
    results: [
      { id: 12, name: "Same Night", first_air_date: today, overview: "A ghost story", poster_path: "/same.jpg" },
      { id: 13, name: "New Haunt", first_air_date: "2026-08-01", overview: "vampire" },
      { id: 14, name: "Comedy", first_air_date: today, overview: "jokes", genre_ids: [35] },
      { id: 15, name: "Plain", first_air_date: today, overview: "nothing" },
      { id: 0, name: "Zero", first_air_date: today, overview: "horror" },
      { id: 16, name: "   ", first_air_date: today, overview: "horror" },
      { id: 17, name: "Undated", overview: "horror" },
      { id: 18, name: "Past Show", first_air_date: "2026-06-14", overview: "slasher" },
      { id: 12, name: "Same Night", first_air_date: today, overview: "ghost" },
    ],
  };
}

function episodeDiscover() {
  const featured = [12, 100, 101, 102, 103, 104, 105, 106, 107];
  const results = [
    { id: 1, name: "Skip", overview: "not scary" },
    { id: 1.2, name: "Half", overview: "horror" },
    { id: 19, name: "Comedy", overview: "horror", genre_ids: [35] },
    ...featured.map((id) => ({ id, name: "Horror", overview: "ghost" })),
    ...Array.from({ length: 40 }, (_, index) => ({ id: 200 + index, name: `Horror ${index}`, overview: "ghost" })),
  ];
  return { total_pages: 1, results };
}

function showDetail(id: number): Record<string, unknown> {
  if (id === 100) {
    return { name: "Excluded", genres: [{ id: 35 }], overview: "horror" };
  }

  if (id === 101) {
    return { name: "No Next", overview: "ghost", keywords: { results: [] } };
  }

  if (id === 102) {
    return {
      name: "Past",
      overview: "ghost",
      next_episode_to_air: { air_date: "2026-06-14", season_number: 1, episode_number: 1, name: "Old" },
    };
  }

  if (id === 103) {
    return {
      name: "Far",
      overview: "ghost",
      next_episode_to_air: { air_date: "2028-06-16", season_number: 1, episode_number: 1 },
    };
  }

  if (id === 104) {
    return { name: "   ", overview: "ghost", next_episode_to_air: { air_date: today } };
  }

  if (id === 105) {
    return { overview: "ghost", next_episode_to_air: { air_date: "not-a-date", name: "Bad" } };
  }

  if (id === 12) {
    return {
      name: "Same Night",
      overview: "A ghost story",
      poster_path: "/same.jpg",
      keywords: { keywords: [{ name: "supernatural" }] },
      next_episode_to_air: { air_date: today, season_number: 1, episode_number: 2, name: "Pilot", overview: "y".repeat(450) },
    };
  }

  if (id === 106) {
    return {
      name: "Bare",
      poster_path: "nope",
      keywords: { results: [null, { id: 3158 }, { name: "cooking" }] },
      next_episode_to_air: { air_date: "2026-06-20", season_number: 0, episode_number: 0 },
    };
  }

  if (id === 107) {
    return {
      name: "Named",
      keywords: { results: "nope", keywords: [{ name: "occult" }] },
      next_episode_to_air: { air_date: "2026-06-21", season_number: "x", episode_number: 1, name: "Special", overview: "   " },
    };
  }

  return {
    name: `Horror ${id}`,
    overview: "ghost",
    poster_path: "/h.jpg",
    next_episode_to_air: { air_date: "2026-06-22", season_number: 2, episode_number: 3, name: "Next" },
  };
}

function router(url: string): Response | undefined {
  if (url.includes("/discover/movie")) {
    return json(films());
  }

  if (url.includes("first_air_date.gte")) {
    return json(premieres());
  }

  if (url.includes("air_date.gte")) {
    return json(episodeDiscover());
  }

  if (url.includes("/tv/airing_today") || url.includes("/tv/on_the_air")) {
    return json({}, 404);
  }

  const showId = /\/tv\/(\d+)/.exec(url);
  if (showId) {
    return json(showDetail(Number(showId[1])));
  }

  return undefined;
}

describe("upcoming", () => {
  it("returns films and horror episodes inside the horizon", async () => {
    handle = installApi([], { env: { TMDBKey: "key" }, fetch: router });
    const { GET } = await import("./upcoming");
    const body = await readBody(await GET());
    const films = body.films as { title: string; releaseDate: string; overview?: string; posterPath?: string }[];
    expect(films.map((item) => item.title)).toEqual(["Ada", "Bram", "Later"]);
    expect(films[0]?.overview?.endsWith("…")).toBe(true);
    expect(films[0]?.posterPath).toBe("/ada.jpg");
    expect(films.find((item) => item.title === "Bram")?.overview).toBeUndefined();
    const shows = body.shows as { title: string; kind: string; detail?: string }[];
    expect(shows.some((item) => item.title === "Same Night" && item.kind === "episode" && item.detail === "S1 E2 · Pilot")).toBe(true);
    expect(shows.some((item) => item.title === "New Haunt" && item.detail === "New series")).toBe(true);
    expect(shows.some((item) => item.title === "Bare" && !item.detail)).toBe(true);
    expect(shows.some((item) => item.detail === "Special")).toBe(true);
  });

  it("reuses a fresh cache and drops titles once the day changes", async () => {
    vi.setSystemTime(new Date("2026-06-15T20:00:00.000Z"));
    handle = installApi([], {
      env: { TMDBKey: "key" },
      fetch: () => json({ total_pages: 1, results: [{ id: 1, title: "Tonight", name: "Tonight", release_date: "2026-06-15", first_air_date: "2026-06-15", overview: "horror" }] }),
    });
    const { GET } = await import("./upcoming");
    const first = await readBody(await GET());
    expect((first.films as { title: string }[]).map((item) => item.title)).toContain("Tonight");
    vi.setSystemTime(new Date("2026-06-15T21:00:00.000Z"));
    const cached = await readBody(await GET());
    expect((cached.films as { title: string }[]).map((item) => item.title)).toContain("Tonight");
    vi.setSystemTime(new Date("2026-06-16T01:00:00.000Z"));
    const nextDay = await readBody(await GET());
    expect(nextDay.films).toEqual([]);
    expect(nextDay.shows).toEqual([]);
  });

  it("drops blank fields, impossible dates, and a failed episode page", async () => {
    handle = installApi([], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("/discover/movie")) {
          return json({
            total_pages: 1,
            results: [
              { id: 30, release_date: today },
              { id: 31, title: "No Day" },
              { id: 32, title: "Quiet Night", release_date: today },
              { id: 33, title: "Leap", release_date: "2026-13-01" },
            ],
          });
        }

        if (url.includes("first_air_date.gte")) {
          return json({
            total_pages: 1,
            results: [
              { id: 21, name: "Haunted", first_air_date: today },
              { id: 22, first_air_date: today, overview: "horror" },
              { id: 23, name: "Ghost", first_air_date: today, poster_path: "/g.jpg" },
            ],
          });
        }

        if (url.includes("air_date.gte")) {
          return json({ total_pages: 1, results: [{ id: 12, name: "Horror", overview: "ghost" }] });
        }

        if (url.includes("/tv/airing_today") || url.includes("/tv/on_the_air")) {
          return json({}, 404);
        }

        if (url.includes("/tv/12")) {
          return json({ name: "Horror", overview: "ghost" });
        }

        return json({ results: [] });
      },
    });
    const { GET } = await import("./upcoming");
    const body = await readBody(await GET());
    expect((body.films as { title: string }[]).map((item) => item.title)).toEqual(["Quiet Night"]);
    const shows = body.shows as { title?: string; overview?: string }[];
    expect(shows.some((item) => item.title === "Haunted" && item.overview === undefined)).toBe(true);
    expect(shows.some((item) => item.title === "")).toBe(false);
  });

  it("reports TMDb configuration and upstream failures", async () => {
    handle = installApi([], { fetch: router });
    delete process.env.TMDBKey;
    const { GET } = await import("./upcoming");
    const missing = await GET();
    expect(missing.status).toBe(503);
    expect(await readBody(missing)).toEqual({ error: "TMDBKey is not configured." });

    vi.resetModules();
    handle.restore();
    handle = installApi([], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/discover/movie") ? json({ status_message: "bad key" }, 401) : json({ results: [] })),
    });
    const { GET: again } = await import("./upcoming");
    const failed = await again();
    expect(failed.status).toBe(502);

    vi.resetModules();
    handle.restore();
    handle = installApi([], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/discover/tv") || url.includes("/tv/") ? json({}, 401) : json({ total_pages: 1, results: [] })),
    });
    const { GET: showsFail } = await import("./upcoming");
    const filmsOnly = await readBody(await showsFail());
    expect(filmsOnly.films).toEqual([]);
    expect(filmsOnly.shows).toEqual([]);
  });
});
