import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./watch";
import { authed, installApi, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const providers = {
  results: {
    US: {
      link: " https://www.justwatch.com/us ",
      flatrate: [
        { provider_id: 8, provider_name: "Netflix", logo_path: "/netflix.jpg", display_priority: 1 },
        { provider_id: 8, provider_name: "Netflix", logo_path: "/again.jpg", display_priority: 2 },
        null,
        { provider_id: 0, provider_name: "Zero" },
        { provider_id: 9, provider_name: "  " },
        { provider_name: "Missing" },
        { provider_id: 3, provider_name: "Hulu", logo_path: "https://cdn.example/hulu.jpg", display_priority: "nope" },
      ],
      rent: "nope",
      buy: [{ provider_id: 2, provider_name: "Apple", logo_path: "", display_priority: 4 }],
      free: [{ provider_id: 5, provider_name: "Tubi", logo_path: "/tubi.jpg", display_priority: 3 }],
      ads: [{ provider_id: 5, provider_name: "Tubi Again" }, { provider_id: 6, provider_name: "Pluto", display_priority: 0 }],
    },
  },
};

describe("watch", () => {
  it("requires a session and rejects titles that cannot stream", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/watch?id=movie:1", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await GET(authed("http://localhost/api/watch?id=movie:1"))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await GET(authed("http://localhost/api/watch"))).status).toBe(404);
    expect(await readBody(await GET(authed("http://localhost/api/watch?id=series:2")))).toEqual({
      error: "Open a movie in the series to see where it is streaming.",
    });
    expect(await readBody(await GET(authed("http://localhost/api/watch?id=book:2")))).toEqual({
      error: "Streaming is only available for movies, documentaries, and TV shows.",
    });
  });

  it("reads a stored TMDb id and maps providers", async () => {
    handle = installApi([
      sessionStep(),
      { match: "FROM movie WHERE id", rows: [{ title: " Hex ", releaseyear: 1999, tmdbid: 42 }] },
    ], {
      env: { TMDBKey: "key" },
      external: [{ match: "/watch/providers", body: providers }],
    });
    const body = await readBody(await GET(authed("http://localhost/api/watch?id=movie:4")));
    expect(body.title).toBe("Hex");
    expect(body.link).toBe("https://www.justwatch.com/us");
    expect(body.streaming).toEqual([
      { name: "Netflix", logo: "https://image.tmdb.org/t/p/w45/netflix.jpg" },
      { name: "Hulu", logo: "https://cdn.example/hulu.jpg" },
    ]);
    expect(body.buy).toEqual([{ name: "Apple" }]);
    expect(body.free).toEqual([
      { name: "Pluto" },
      { name: "Tubi", logo: "https://image.tmdb.org/t/p/w45/tubi.jpg" },
    ]);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "FROM documentary WHERE id", rows: [{ title: "Doc", releaseyear: null, tmdbid: 7 }] },
    ], {
      env: { TMDBKey: "key" },
      external: [{ match: "/watch/providers", body: { results: { FR: {} } } }],
    });
    const empty = await readBody(await GET(authed("http://localhost/api/watch?id=documentary:3")));
    expect(empty).toMatchObject({ title: "Doc", streaming: [], rent: [], buy: [], free: [] });
    expect(empty.link).toBeUndefined();

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "FROM show WHERE id", rows: [{ title: "Show", releaseyear: 2010, tmdbid: 8 }] },
    ], {
      env: { TMDBKey: "key" },
      external: [{ match: "/watch/providers", body: { results: { US: { link: "   ", flatrate: [] } } } }],
    });
    const show = await readBody(await GET(authed("http://localhost/api/watch?id=show:2")));
    expect(show.link).toBeUndefined();
    expect(show.streaming).toEqual([]);
  });

  it("resolves a TMDb id from the title and stores it", async () => {
    handle = installApi([
      sessionStep(),
      { match: "FROM movie WHERE id", rows: [{ title: "Hex", releaseyear: 1999 }] },
    ], {
      env: { TMDBKey: "key" },
      external: [
        {
          match: "/search/movie",
          body: {
            results: [
              null,
              { id: 0, title: "Hex" },
              { id: 4, title: "Other", release_date: "1999-01-01" },
              { title: "Hex" },
              { id: 5, title: " hex ", release_date: "1998-01-01" },
              { id: 6, title: "Hex", release_date: "1999-05-01" },
            ],
          },
        },
        { match: "/watch/providers", body: { results: {} } },
      ],
    });
    const matched = await readBody(await GET(authed("http://localhost/api/watch?id=movie:4")));
    expect(matched.title).toBe("Hex");
    expect(handle.calls.some((call) => call.query.includes("UPDATE movie SET tmdbid") && call.params[0] === 6)).toBe(true);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "FROM show WHERE id", rows: [{ title: "Hex", releaseyear: "nope" }] },
    ], {
      env: { TMDBKey: "key" },
      external: [
        {
          match: "/search/tv",
          body: { results: [{ id: 11, name: "Hex", first_air_date: "2010-01-01" }, { id: 12, name: " hex " }] },
        },
        { match: "/watch/providers", body: { results: null } },
      ],
    });
    expect((await GET(authed("http://localhost/api/watch?id=show:2"))).status).toBe(200);
    expect(handle.calls.some((call) => call.query.includes("UPDATE show SET tmdbid") && call.params[0] === 11)).toBe(true);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM movie WHERE id", rows: [{ title: "A" }] }], { env: { TMDBKey: "key" } });
    expect((await GET(authed("http://localhost/api/watch?id=movie:1"))).status).toBe(404);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "FROM documentary WHERE id", rows: [{ title: "Missing", releaseyear: 2001 }] },
    ], {
      env: { TMDBKey: "key" },
      external: [{ match: "/search/movie", body: { results: [{ id: 3, title: "Other", release_date: "2001-01-01" }] } }],
    });
    expect((await GET(authed("http://localhost/api/watch?id=documentary:2"))).status).toBe(404);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM movie WHERE id", rows: [] }]);
    expect((await GET(authed("http://localhost/api/watch?id=movie:9"))).status).toBe(404);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM show WHERE id", rows: [{ title: "   ", tmdbid: 1 }] }]);
    expect((await GET(authed("http://localhost/api/watch?id=show:9"))).status).toBe(404);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM movie WHERE id", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/watch?id=movie:1"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not look up where to watch." });
  });
});
