import { afterEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "./shows";
import { authed, installApi, jsonCall, readBody, sessionStep, type ApiHandle, type ExternalRoute } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const showPayload = {
  seasons: [
    null,
    "bad",
    { season_number: -1, name: "Nope" },
    { season_number: 0, name: "  " },
    { season_number: 1, name: "The Beginning" },
    { season_number: 2, name: "" },
    { season_number: 2.5, name: "Half" },
  ],
  number_of_episodes: 3,
  number_of_seasons: 1,
  episode_run_time: [42],
  first_air_date: "2010-10-31",
};

const seasonPayload = {
  episodes: [
    null,
    "bad",
    { episode_number: 0, name: "Zero" },
    { episode_number: 1, name: "Pilot", runtime: 44, air_date: "2010-10-31" },
    { episode_number: 2, name: "  ", runtime: Number.NaN },
    { episode_number: 1.5, name: "Half" },
  ],
};

const tmdbRoutes: ExternalRoute[] = [
  { match: "/season/", body: seasonPayload },
  { match: "/tv/", body: showPayload },
];

const guideRows = [
  { id: 7, season_number: 1, title: "One", episode_count: 2 },
  { id: 8, season_number: 2, title: "", episode_count: 0 },
];

const episodeRows = [
  { id: 1, episode_number: 1, title: "Pilot", runtime: 44, air_date: "2010-10-31", progress_id: 1, completed_at: "2020-01-01T00:00:00.000Z" },
  { id: 2, episode_number: 2, title: "", runtime: 0, air_date: null, progress_id: 2, completed_at: null },
  { id: 3, episode_number: 3, title: "Lost", runtime: "nope", air_date: "bad", progress_id: null, completed_at: null },
];

describe("show guide", () => {
  it("requires a session and a real show", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/shows?id=show:4", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await GET(authed("http://localhost/api/shows?id=show:4"))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await GET(authed("http://localhost/api/shows"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/shows?id=movie:1"))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT id FROM show WHERE id = $1", rows: [] }]);
    expect((await GET(authed("http://localhost/api/shows?id=show:4"))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT id FROM show WHERE id = $1", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/shows?id=show:4"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not load that show." });
  });

  it("refreshes seasons and episodes from TMDb", async () => {
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [], once: true },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }, { season_number: "x" }] },
      { match: "SELECT id FROM show_season WHERE show_id = $1 AND season_number", rows: [{ id: 7 }] },
      { match: "COUNT(*)::int AS count FROM show_episode", rows: [{ count: 0 }], once: true },
      { match: "COUNT(*)::int AS count FROM show_episode", rows: [{ count: 2 }] },
      { match: "AS episode_count", rows: guideRows },
      { match: "AS progress_id", rows: episodeRows },
    ], { env: { TMDBKey: "key" }, external: tmdbRoutes });
    const body = await readBody(await GET(authed("http://localhost/api/shows?id=show:4&season=1")));
    expect(body.showId).toBe(4);
    const seasons = body.seasons as { episodeCount: number; loaded: boolean; finishedCount: number; episodes: { undated?: boolean; watchedYear?: number; year?: number; completed: boolean }[] }[];
    expect(seasons[0]?.episodeCount).toBe(2);
    expect(seasons[0]?.finishedCount).toBe(2);
    expect(seasons[0]?.episodes[0]).toMatchObject({ completed: true, watchedYear: 2020, year: 2010 });
    expect(seasons[0]?.episodes[1]).toMatchObject({ completed: true, undated: true });
    expect(seasons[0]?.episodes[2]?.completed).toBe(false);
    expect(seasons[1]?.episodeCount).toBe(3);
    expect(seasons[1]?.loaded).toBe(true);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A", releaseyear: 2010 }] },
      { match: "AS episode_count", rows: [{ id: 1, season_number: 1, title: "Only", episode_count: 4 }] },
      { match: "AS progress_id", rows: [] },
    ]);
    const plain = await readBody(await GET(authed("http://localhost/api/shows?id=show:4&season=")));
    expect(plain.seasons).toEqual([expect.objectContaining({ episodeCount: 4, loaded: false, episodes: [] })]);
    expect((await GET(authed("http://localhost/api/shows?id=show:4&season=1.5"))).status).toBe(200);
    expect((await GET(authed("http://localhost/api/shows?id=show:4"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [], once: true },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 3 }] },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'show'", error: "no progress table" },
      { match: "AS episode_count", rows: [] },
    ], { env: { TMDBKey: "key" }, external: [{ match: "/tv/", body: { seasons: [] } }] });
    expect((await GET(authed("http://localhost/api/shows?id=show:4&season=0"))).status).toBe(200);
  });

  it("marks episodes, seasons, and whole shows", async () => {
    handle = installApi([
      sessionStep(),
      { match: "SELECT show_id FROM show_episode", rows: [{ show_id: 4 }] },
      { match: "AS missing", rows: [{ total: 2, missing: 0, finished: 2 }] },
      { match: "AS episode_count", rows: [] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 5, completed: true, dated: false }))).status).toBe(200);
    expect(handle.calls.some((call) => call.query.includes("ELSE NULL"))).toBe(true);

    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 5, completed: true, year: 2020 }))).status).toBe(200);
    expect(handle.calls.some((call) => call.params.includes("2020-07-01T12:00:00.000Z"))).toBe(true);

    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 5, completed: true }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 5, completed: false }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT show_id FROM show_episode", rows: [{ show_id: 4 }] },
      { match: "AS missing", rows: [{ total: 2, missing: 1, finished: 1 }] },
      { match: "AS episode_count", rows: [] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 5, completed: true, year: 1800 }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT show_id FROM show_episode", rows: [] }]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 5, completed: true }))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT show_id, season_number FROM show_season WHERE id", rows: [{ show_id: 4, season_number: 1 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A" }] },
      { match: "AS missing", rows: [{}] },
      { match: "AS episode_count", rows: [] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { seasonId: 3, completed: true }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { seasonId: 3, completed: false }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT show_id, season_number FROM show_season WHERE id", rows: [{ show_id: 4, season_number: 1 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "SELECT id FROM show_season WHERE show_id = $1 AND season_number", rows: [{ id: 7 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
      { match: "COUNT(*)::int AS count FROM show_episode", rows: [{ count: 1 }] },
      { match: "AS missing", rows: [{ total: 1, missing: 0, finished: 1 }] },
      { match: "AS episode_count", rows: [] },
    ], { env: { TMDBKey: "key" }, external: tmdbRoutes });
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { seasonId: 3, completed: false }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT show_id, season_number FROM show_season WHERE id", rows: [] }]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { seasonId: 3, completed: true }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT show_id, season_number FROM show_season WHERE id", rows: [{ show_id: 4, season_number: "nope" }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { seasonId: 3, completed: true }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT show_id, season_number FROM show_season WHERE id", rows: [{ season_number: 1 }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { seasonId: 3, completed: true }))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "ORDER BY season_number", rows: [{ season_number: 1 }, { season_number: "x" }] },
      { match: "SELECT id FROM show_season WHERE show_id = $1 AND season_number", rows: [] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
      { match: "AS missing", rows: [{ total: 1, missing: 0, finished: 0 }] },
      { match: "AS episode_count", rows: [] },
    ], { env: { TMDBKey: "key" }, external: tmdbRoutes });
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { id: "show:4", completed: true }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A" }] },
      { match: "AS missing", rows: [{ total: 0, missing: 0, finished: 0 }] },
      { match: "AS episode_count", rows: [] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { id: "show:4", completed: true }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { id: "show:4", completed: false }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: 0, seasonId: 0 }))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/shows", "PATCH", "not-json"))).status).toBe(400);
  });
});
