import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "./talent";
import { authed, installApi, jsonCall, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";
import { resetTalentSchema } from "../lib/talent";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
  resetTalentSchema();
});

describe("talent routes", () => {
  it("requires a session and serves credits, a person, and the follow list", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/talent", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep()], {
      env: { TMDBKey: "key" },
      external: [{ match: "/movie/15/credits", body: { crew: [{ id: 2, name: "Carpenter", job: "Director" }], cast: [] } }],
    });
    handle.calls.length = 0;
    const listed = await readBody(await GET(authed("http://localhost/api/talent")));
    expect(listed.people).toEqual([]);

    handle.restore();
    resetTalentSchema();
    handle = installApi([sessionStep(), { match: "talent_filmography", rows: [] }], {
      env: { TMDBKey: "key" },
      external: [
        { match: "/discover/movie", body: { page: 1, total_pages: 1, results: [] } },
        { match: "/discover/tv", body: { page: 1, total_pages: 1, results: [] } },
        { match: "air_date", body: { page: 1, total_pages: 1, results: [] } },
        { match: "/tv/airing_today", body: { page: 1, total_pages: 1, results: [] } },
        { match: "/tv/on_the_air", body: { page: 1, total_pages: 1, results: [] } },
      ],
    });
    expect(await readBody(await GET(authed("http://localhost/api/talent?upcoming=1")))).toEqual({ titles: [] });

    handle.restore();
    resetTalentSchema();
    handle = installApi([{ match: "SELECT tmdbid FROM movie", rows: [{ tmdbid: 15 }] }, sessionStep()], {
      env: { TMDBKey: "key" },
      external: [{ match: "/movie/15/credits", body: { crew: [{ id: 2, name: "Carpenter", job: "Director" }], cast: [] } }],
    });
    const credits = await readBody(await GET(authed("http://localhost/api/talent?title=movie:4")));
    expect(credits.directors).toEqual([{ id: 2, name: "Carpenter", role: "Director" }]);

    handle.restore();
    resetTalentSchema();
    handle = installApi([sessionStep()], {
      env: { TMDBKey: "key" },
      external: [{ match: "/person/500", body: { id: 500, name: "Jamie", combined_credits: { cast: [], crew: [] } } }],
    });
    const opened = await readBody(await GET(authed("http://localhost/api/talent?person=500")));
    expect(opened.person).toMatchObject({ id: 500, name: "Jamie", following: false, total: 0 });
    expect((await GET(authed("http://localhost/api/talent?person=0"))).status).toBe(400);

    const followed = await readBody(await POST(jsonCall("http://localhost/api/talent", "POST", { personId: 500 })));
    expect(followed.person).toMatchObject({ following: true });
    expect((await POST(jsonCall("http://localhost/api/talent", "POST", "not-json"))).status).toBe(400);

    const removed = await readBody(await DELETE(authed("http://localhost/api/talent?person=500")));
    expect(removed.person).toMatchObject({ following: false });
    expect((await DELETE(authed("http://localhost/api/talent"))).status).toBe(400);
  });

  it("reports a database failure and a missing database", async () => {
    handle = installApi([sessionStep(), { match: "SELECT person_id, name", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/talent"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not load that filmography." });

    handle.restore();
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    expect((await GET(authed("http://localhost/api/talent"))).status).toBe(503);
    expect((await POST(jsonCall("http://localhost/api/talent", "POST", {}))).status).toBe(503);
    expect((await DELETE(authed("http://localhost/api/talent?person=1"))).status).toBe(503);
  });
});
