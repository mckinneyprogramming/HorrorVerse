import { afterEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "./progress";
import { authed, installApi, jsonCall, memberRow, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const progressRows = [
  { media_kind: "movie", media_id: 1, completed_at: "2020-07-01T12:00:00.000Z", score: 5 },
  { media_kind: "movie", media_id: 2, completed_at: null, score: 0 },
  { media_kind: "show", media_id: 3, completed_at: "not-a-date", score: 1.5 },
  { media_kind: "book", media_id: 4, completed_at: "", score: 6 },
  { media_kind: "movie", media_id: 5, completed_at: "2019-01-01T00:00:00.000Z", score: "4" },
];

function librarySteps() {
  return [
    sessionStep(),
    { match: "score FROM user_media_progress", rows: progressRows },
    {
      match: "LIMIT 48",
      rows: [
        { media_kind: "movie", media_id: 1 },
        { media_kind: "podcast", media_id: 1 },
      ],
    },
    {
      match: "SELECT DISTINCT ON (s.id)",
      rows: [
        { id: 5, title: "Haunting", posterpath: "/already.jpg", season_number: 1, episode_number: 1, episode_title: "Pilot", last_watched: "2024-01-02" },
        { id: 6, title: "Plain", posterpath: "", season_number: 1, episode_number: 2, episode_title: "", last_watched: "" },
      ],
    },
    {
      match: "FROM book b",
      rows: [{ kind: "book", id: 8, title: "Tome", releaseyear: 2001 }],
    },
    { match: "posterpath FROM movie", rows: [{ tmdbid: 10, posterpath: "/home.jpg" }] },
    { match: "posterpath FROM show", rows: [{ tmdbid: 11, posterpath: "/show.jpg" }] },
  ];
}

describe("progress", () => {
  it("requires a session and returns scored, undated, and poster data", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/progress", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await GET(authed("http://localhost/api/progress"))).status).toBe(401);

    handle.restore();
    handle = installApi(librarySteps());
    const response = await GET(authed("http://localhost/api/progress"));
    expect(response.status).toBe(200);
    const body = await readBody(response);
    expect(body.ids).toContain("movie:1");
    expect(body.undatedIds).toContain("movie:2");
    expect(body.watchedYears).toMatchObject({ "movie:1": 2020, "movie:5": 2019 });
    expect(body.scores).toMatchObject({ "movie:1": 5, "movie:5": 4 });
    expect(body.recentPosters).toMatchObject({ "movie:1": "/home.jpg" });
    expect(body.recentPosters).not.toHaveProperty("podcast:1");
    const watchNext = body.watchNext as { id: string; posterPath?: string }[];
    expect(watchNext.find((item) => item.id === "show:5")?.posterPath).toBe("/already.jpg");
    expect(watchNext.find((item) => item.id === "show:6")?.posterPath).toBe("/show.jpg");
    const readNext = body.readNext as { id: string; posterPath?: string }[];
    expect(readNext.some((item) => item.id === "book:8" && !item.posterPath)).toBe(true);
  });

  it("seeds an admin library once and ignores a missing catalog table", async () => {
    handle = installApi([
      sessionStep({ ...memberRow, is_admin: true }),
      { match: "FROM user_progress_seed", rows: [] },
      { match: "FROM documentary WHERE watched", error: "missing documentary" },
    ]);
    const seeded = await GET(authed("http://localhost/api/progress"));
    expect(seeded.status).toBe(200);
    expect(handle.calls.some((call) => call.query.includes("INSERT INTO user_progress_seed"))).toBe(true);
    expect(handle.calls.some((call) => call.query.includes("FROM movie WHERE watched"))).toBe(true);

    handle.restore();
    handle = installApi([
      sessionStep({ ...memberRow, is_admin: true }),
      { match: "FROM user_progress_seed", rows: [{ "?column?": 1 }] },
    ]);
    expect((await GET(authed("http://localhost/api/progress"))).status).toBe(200);
    expect(handle.calls.some((call) => call.query.includes("FROM movie WHERE watched"))).toBe(false);
  });

  it("scores a finished title and rejects scores that are not 1 through 5", async () => {
    handle = installApi([sessionStep(), { match: "SET score", rows: [{ media_id: 1 }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: 5 }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: null }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: "" }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: "3" }))).status).toBe(200);

    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: 0 }))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: 6 }))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: 1.5 }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SET score", rows: [] }]);
    const unfinished = await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:1", score: 1 }));
    expect(unfinished.status).toBe(400);
    expect(await readBody(unfinished)).toEqual({ error: "Mark that title finished before scoring it." });
  });

  it("marks titles finished with and without a year and clears them", async () => {
    handle = installApi([sessionStep()]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "book:4", completed: true, dated: false }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "podcast:2", completed: true, year: 2020 }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "game:3", completed: true, year: 1800 }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "documentary:8", completed: false }))).status).toBe(200);
    expect(handle.calls.some((call) => call.query.includes("completed_at = NULL") || call.query.includes("VALUES ($1, $2, $3, NULL)"))).toBe(true);
    expect(handle.calls.some((call) => call.query.includes("NOW()"))).toBe(true);
    expect(handle.calls.some((call) => call.query.includes("$4::timestamptz"))).toBe(true);
  });

  it("cascades series movies and syncs a movie back to its series", async () => {
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM movie WHERE seriesid", rows: [{ id: 0 }, { id: 9 }, {}] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "series:3", completed: true, year: 2019 }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "series:3", completed: false, dated: false }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT id FROM movie WHERE seriesid", error: "no movie table" }]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "series:3", completed: true }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT seriesid FROM movie", rows: [{}] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:4", completed: true }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT seriesid FROM movie", rows: [{ seriesid: 6 }] },
      { match: "AS finished", rows: [{ total: 2, finished: 2 }] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:4", completed: true, year: 2021 }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT seriesid FROM movie", rows: [{ seriesid: 6 }] },
      { match: "AS finished", rows: [{ total: 2, finished: 1 }] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:4", completed: true, dated: false }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT seriesid FROM movie", rows: [{ seriesid: 6 }] },
      { match: "AS finished", rows: [{}] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:4", completed: false }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT seriesid FROM movie", rows: [{ seriesid: "nope" }] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:4", completed: true }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT seriesid FROM movie", error: "no movie table" }]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", { id: "movie:4", completed: true }))).status).toBe(200);
  });

  it("rejects an invalid id, invalid JSON, and a database error", async () => {
    handle = installApi([sessionStep()]);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", {}))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/progress", "PATCH", "not-json"))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "score FROM user_media_progress", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/progress"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not update your library." });

    handle.restore();
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    const missing = await GET(authed("http://localhost/api/progress"));
    expect(missing.status).toBe(503);
    expect(await readBody(missing)).toEqual({ error: "DATABASE_URL is not configured." });
  });
});
