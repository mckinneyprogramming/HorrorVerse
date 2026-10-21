import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./sync";
import { adminRow, authed, installApi, jsonCall, memberRow, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const recent = new Date().toISOString();

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const movieSearch = (url: string): Response | undefined => {
  if (!url.includes("/search/movie")) {
    return undefined;
  }

  const query = decodeURIComponent(url).toLowerCase();
  if (query.includes("query=other")) {
    return json({ results: [{ id: 70, title: "Other", release_date: "1990-01-01" }] });
  }

  if (query.includes("query=dated")) {
    return json({
      results: [
        { id: 71, title: "Other", release_date: "1990-01-01" },
        { id: 72, title: "Dated", release_date: "1999-05-01" },
      ],
    });
  }

  if (query.includes("query=plain")) {
    return json({ results: [{ id: 73, title: "Plain", release_date: "2004-01-01" }] });
  }

  if (query.includes("query=ghost")) {
    return json({ results: [{ id: 0, title: "Ghost" }, { title: "Ghost" }] });
  }

  return json({ results: [] });
};

describe("vault sync", () => {
  it("rejects anonymous callers and accepts a trusted cron", async () => {
    handle = installApi([], { env: { CRON_SECRET: "top-secret" } });
    expect((await GET(authed("http://localhost/api/sync", {}, null))).status).toBe(401);
    expect((await GET(authed("http://localhost/api/sync", { headers: { authorization: "Bearer nope" } }, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }], { env: { CRON_SECRET: "   " } });
    expect((await GET(authed("http://localhost/api/sync"))).status).toBe(401);

    handle.restore();
    handle = installApi([], { env: { CRON_SECRET: "top-secret", TMDBKey: "key" } });
    const cron = await GET(new Request("http://localhost/api/sync", { headers: { authorization: "Bearer top-secret" } }));
    expect(cron.status).toBe(200);

    handle.restore();
    handle = installApi([], { env: { TMDBKey: "key" } });
    const vercel = await GET(new Request("http://localhost/api/sync", { headers: { "x-vercel-cron": "1" } }));
    expect(vercel.status).toBe(200);
    const ignored = await GET(new Request("http://localhost/api/sync", { headers: { "x-vercel-cron": "0" } }));
    expect(ignored.status).toBe(401);
  });

  it("skips a fresh vault and refreshes a stale one", async () => {
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT last_synced_at", rows: [{ last_synced_at: recent }] },
    ], { env: { TMDBKey: "key" } });
    const fresh = await readBody(await GET(authed("http://localhost/api/sync")));
    expect(fresh).toMatchObject({ skipped: true, seriesAdded: 0, showsAdded: 0 });

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT last_synced_at", rows: [{ last_synced_at: "2000-01-01T00:00:00.000Z" }] },
      { match: "SELECT id FROM movieseries ORDER BY id", rows: [{ id: null }, { id: 5 }] },
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [] },
      { match: "SELECT id FROM show ORDER BY id", rows: [{ id: "nope" }, { id: 8 }] },
      { match: "SELECT id FROM show WHERE id = $1", rows: [] },
    ], { env: { TMDBKey: "key" } });
    const stale = await readBody(await GET(authed("http://localhost/api/sync")));
    expect(stale.skipped).toBeUndefined();
    expect(stale.seriesAdded).toBe(0);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT last_synced_at", rows: [{ last_synced_at: recent }] },
      { match: "SELECT id FROM show ORDER BY id", error: "no show table" },
    ], { env: { TMDBKey: "key" } });
    const forced = await readBody(await GET(authed("http://localhost/api/sync")));
    expect(forced).toMatchObject({ seriesAdded: 0, showsAdded: 0 });

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT last_synced_at", rows: [{ last_synced_at: "not-a-date" }] },
    ], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/sync"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT last_synced_at", rows: [{}] },
    ], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/sync"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(memberRow), { match: "SELECT last_synced_at", error: "missing sync" }], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/sync"))).status).toBe(200);
  });

  it("tags movies, documentaries, and shows that are missing keywords", async () => {
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT last_synced_at", rows: [{ last_synced_at: recent }] },
      {
        match: "releaseyear, tmdbid FROM movie",
        rows: [
          { id: 0, title: "Skip" },
          { id: 9, title: "Kept", tmdbid: 15 },
          { id: 4, title: "Boom", tmdbid: 16 },
          { id: 5, title: "Hex", releaseyear: 1999, tmdbid: 15 },
          { id: 6, title: "A", releaseyear: 1999 },
          { id: 7, title: "Other", releaseyear: 1998 },
          { id: 8, title: "Dated", releaseyear: 1999 },
          { id: 11, title: "Plain" },
          { id: 12, title: "Ghost", releaseyear: 2001 },
        ],
      },
      { match: "SELECT 1 AS present FROM media_keyword WHERE media_kind = $1 AND media_id = $2", rows: [{ present: 1 }], once: true },
      { match: "SELECT 1 AS present FROM media_keyword WHERE media_kind = $1 AND media_id = $2", error: "no keywords", once: true },
      { match: "SELECT 1 AS present FROM media_keyword WHERE media_kind = $1 AND media_id = $2", rows: [] },
      { match: "releaseyear, tmdbid FROM documentary", rows: [{ id: 0 }, { id: 3, title: "Doc", tmdbid: 21 }, { id: 4, title: "B", releaseyear: 2000 }] },
      { match: "SELECT id, tmdbid FROM show", rows: [{ id: null }, { id: 2, tmdbid: 30 }, { id: 3 }] },
      { match: "SELECT id FROM movieseries ORDER BY id", rows: [{ id: null }, { id: 2 }] },
    ], { env: { TMDBKey: "key" }, fetch: movieSearch });
    const body = await readBody(await GET(authed("http://localhost/api/sync")));
    expect(body.skipped).toBe(false);
    expect(Number(body.keywordsAdded)).toBeGreaterThan(0);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT last_synced_at", rows: [{ last_synced_at: recent }] },
      { match: "releaseyear, tmdbid FROM movie", rows: [{ id: 6, title: "Hex", tmdbid: 1 }, { id: 7, title: "Other", tmdbid: 2 }] },
      { match: "SELECT 1 AS present FROM media_keyword WHERE media_kind = $1 AND media_id = $2", rows: [] },
    ], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/sync?id=movie:6"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/sync?id=documentary:3"))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 2 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A" }] },
      { match: "SELECT id, tmdbid FROM show", rows: [{ id: 2, tmdbid: 30 }, { id: 8 }, { id: 0 }] },
    ], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/sync?id=show:2"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 2, title: "A" }] },
      { match: "releaseyear, tmdbid FROM movie", rows: [{ id: 6, title: "Hex", tmdbid: 1 }, { id: 7, title: "Other" }] },
      { match: "releaseyear, tmdbid FROM documentary", rows: [{ id: 3, title: "Doc", tmdbid: 9 }] },
    ], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/sync?id=series:2"))).status).toBe(200);
  });

  it("refreshes one series or show and rejects other ids", async () => {
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 3, title: "Scream", tmdbid: 77 }] },
      { match: "SELECT id FROM movie WHERE tmdbid", rows: [{ id: 4 }], once: true },
      { match: "SELECT id FROM movie WHERE lower(title)", rows: [] },
      { match: "INSERT INTO movie (title, totaltime, partofseries", rows: [{ id: 9 }], once: true },
      { match: "INSERT INTO movie (title, totaltime, partofseries", rows: [] },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'series'", error: "no progress", once: true },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("/collection/77")) {
          return json({
            id: 77,
            poster_path: "/c.jpg",
            parts: [
              { id: 10, title: "Scream", release_date: "1996-12-20", poster_path: "/a.jpg" },
              { id: 11, title: "Scream 2", release_date: "1997-12-12", poster_path: "/b.jpg" },
              { id: 12, title: "Scream 3", release_date: "2000-02-04" },
            ],
          });
        }

        if (url.includes("/movie/10")) {
          return json({ title: "Scream", release_date: "1996-12-20", runtime: 111, poster_path: "/a.jpg" });
        }

        if (url.includes("/movie/11")) {
          return json({ title: "Scream 2", release_date: "1997-12-12", runtime: 120, poster_path: "/b.jpg" });
        }

        if (url.includes("/movie/12")) {
          return json({ title: "", release_date: "2000-02-04", runtime: 0 });
        }

        if (url.includes("/keywords")) {
          return json({ keywords: [] });
        }

        return movieSearch(url);
      },
    });
    const series = await readBody(await GET(authed("http://localhost/api/sync?id=series:3")));
    expect(Number(series.added)).toBeGreaterThan(0);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 3, title: "A" }] },
    ], { env: { TMDBKey: "key" } });
    expect(await readBody(await GET(authed("http://localhost/api/sync?id=series:3")))).toMatchObject({ added: 0 });

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 3, title: "Hellraiser" }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("query=Hellraiser%20Collection") || url.includes("Hellraiser+Collection") || url.includes("Hellraiser Collection")) {
          return json({ results: [{ id: 55, name: "Hellraiser Collection" }] });
        }

        if (url.includes("/search/collection")) {
          return json({ results: [{ id: 0, name: "Hellraiser" }, { id: 1.5, name: "Hellraiser" }, { id: 4, name: "Other" }] });
        }

        if (url.includes("/collection/55")) {
          return json({ parts: [{ genre_ids: [27] }] });
        }

        if (url.includes("/collection/")) {
          return json({ parts: [] });
        }

        return json({ poster_path: null, parts: [] });
      },
    });
    expect((await GET(authed("http://localhost/api/sync?id=series:3"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(memberRow), { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [] }]);
    expect((await GET(authed("http://localhost/api/sync?id=series:3"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/sync?id=movie:3"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/sync?id=show:0"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/sync?id=nope"))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 8 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 40 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [], once: true },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/tv/40") ? json({ name: "Hex", seasons: [{ season_number: 1, name: "One" }], number_of_episodes: 1, number_of_seasons: 1, episode_run_time: [40], first_air_date: "2010-01-01" }) : json({})),
    });
    const show = await readBody(await GET(authed("http://localhost/api/sync?id=show:8")));
    expect(Number(show.added)).toBeGreaterThan(0);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 8 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A" }] },
    ]);
    expect(await readBody(await GET(authed("http://localhost/api/sync?id=show:8")))).toMatchObject({ added: 0 });

    handle.restore();
    handle = installApi([sessionStep(memberRow), { match: "SELECT id FROM show WHERE id = $1", rows: [] }]);
    expect((await GET(authed("http://localhost/api/sync?id=show:8"))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 8 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 40 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'show'", error: "no progress" },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/tv/40") ? json({ seasons: [{ season_number: 2, name: "Two" }] }) : json({})),
    });
    expect((await GET(authed("http://localhost/api/sync?id=show:8"))).status).toBe(200);
  });

  it("imports horror batches for an administrator", async () => {
    handle = installApi();
    expect((await POST(jsonCall("http://localhost/api/sync", "POST", { import: "horror-films" }, null))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep(memberRow)]);
    expect((await POST(jsonCall("http://localhost/api/sync", "POST", { import: "horror-films" }))).status).toBe(403);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await POST(jsonCall("http://localhost/api/sync", "POST", { import: "horror-films" }))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep(adminRow)], { env: { TMDBKey: "key" } });
    expect((await POST(jsonCall("http://localhost/api/sync", "POST", {}))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/sync", "POST", "not-json"))).status).toBe(400);
    const films = await readBody(await POST(jsonCall("http://localhost/api/sync", "POST", { import: "horror-films" })));
    expect(films.import).toBe("horror-films");
    const collections = await readBody(await POST(jsonCall("http://localhost/api/sync", "POST", { import: "horror-collections" })));
    expect(collections.import).toBe("horror-collections");

    handle.restore();
    handle = installApi([{ match: "FROM app_session", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/sync"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not refresh the vault from TMDb." });

    handle.restore();
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    expect((await POST(jsonCall("http://localhost/api/sync", "POST", { import: "horror-films" }))).status).toBe(503);
  });
});
