import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./tmdb";
import { authed, installApi, jsonCall, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

function movieHit(id: number, title: string, genres: number[], extra: Record<string, unknown> = {}) {
  return { id, title, genre_ids: genres, release_date: "1999-10-31", overview: "Boo", ...extra };
}

const horrorMovies = [
  null,
  movieHit(1, "Hex", [27]),
  movieHit(2, "Both", [27, 99]),
  movieHit(3, "Plain", [18]),
  movieHit(0, "Zero", [27]),
  movieHit(4, "   ", [27]),
  movieHit(5, "Five", [27], { release_date: "", overview: "" }),
  movieHit(6, "Six", [27], { overview: "x".repeat(200) }),
  movieHit(7, "Seven", [53]),
  movieHit(8, "Eight", [27]),
  movieHit(9, "Nine", [27]),
  movieHit(10, "Ten", [27]),
  movieHit(11, "Eleven", [27]),
  movieHit(12, "Twelve", [99], { overview: "doc" }),
];

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("tmdb search", () => {
  it("requires a session and a long enough query", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/tmdb?q=he", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await GET(authed("http://localhost/api/tmdb?q=he"))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await GET(authed("http://localhost/api/tmdb?q=h"))).status).toBe(400);
    expect(await readBody(await GET(authed("http://localhost/api/tmdb?kind=book&q=h")))).toEqual({
      error: "Enter at least two characters to search Open Library.",
    });
    expect(await readBody(await GET(authed("http://localhost/api/tmdb?kind=game&q=h")))).toEqual({
      error: "Enter at least two characters to search IGDB.",
    });
    expect((await GET(authed("http://localhost/api/tmdb?kind=opera&q=hex"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/tmdb?poster=nope"))).status).toBe(400);
  });

  it("searches movies, documentaries, shows, and collections", async () => {
    handle = installApi([sessionStep()], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("/search/movie")) {
          return json({ results: horrorMovies });
        }

        if (url.includes("/search/tv")) {
          return json({
            results: [
              { id: 1, name: "Hex", genre_ids: [27], first_air_date: "2010-10-31", overview: "Boo" },
              { id: 2, name: "Doc", genre_ids: [99] },
              { id: 3, name: "Plain", genre_ids: [18] },
              { id: 0, name: "Zero", genre_ids: [27] },
              { id: 4, name: "  ", genre_ids: [27] },
              { id: 5, name: "Five", genre_ids: [10765], first_air_date: "" },
            ],
          });
        }

        if (url.includes("/search/collection")) {
          const results = [
            { id: 0, name: "Zero" },
            { id: 1.5, name: "Half" },
            { id: 2, name: "   " },
            { id: 3, name: "Comedy" },
            ...Array.from({ length: 9 }, (_, index) => ({ id: 20 + index, name: `Hell ${index} Collection`, overview: index === 0 ? "" : "Fog" })),
          ];
          return json({ results });
        }

        if (url.includes("/collection/3")) {
          return json({ parts: [{ genre_ids: [35] }] });
        }

        if (url.includes("/collection/")) {
          return json({ parts: [{ genre_ids: [27] }, { genre_ids: [18] }] });
        }

        return undefined;
      },
    });

    const movies = await readBody(await GET(authed("http://localhost/api/tmdb?kind=MOVIE&q=hex")));
    expect((movies.results as { tmdbId: number }[]).some((item) => item.tmdbId === 1)).toBe(true);
    expect((movies.results as { tmdbId: number }[]).some((item) => item.tmdbId === 2)).toBe(false);

    const docs = await readBody(await GET(authed("http://localhost/api/tmdb?kind=documentary&q=hex")));
    expect((docs.results as { title: string }[]).map((item) => item.title)).toContain("Both");

    const shows = await readBody(await GET(authed("http://localhost/api/tmdb?kind=show&q=hex")));
    expect((shows.results as { title: string }[]).map((item) => item.title)).toEqual(expect.arrayContaining(["Hex", "Doc"]));

    const series = await readBody(await GET(authed("http://localhost/api/tmdb?kind=series&q=hell")));
    expect((series.results as unknown[]).length).toBe(8);
  });

  it("proxies a poster and searches books and games", async () => {
    handle = installApi([sessionStep()], {
      env: { IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "secret" },
      fetch: (url) => {
        if (url.includes("image.tmdb.org")) {
          return new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
        }

        if (url.includes("openlibrary.org")) {
          return json({ docs: [{ key: "/works/OL1W", title: "Dracula", subject: ["Horror"] }] });
        }

        if (url.includes("api.igdb.com")) {
          return json([{ id: 10, name: "Silent Hill", genres: [{ name: "Horror" }] }]);
        }

        return undefined;
      },
    });
    const poster = await GET(authed("http://localhost/api/tmdb?poster=/hex.jpg&size=w92"));
    expect(poster.headers.get("content-type")).toContain("image/");

    const books = await readBody(await GET(authed("http://localhost/api/tmdb?kind=book&q=dra")));
    expect((books.results as { title: string }[])[0]?.title).toBe("Dracula");

    const games = await readBody(await GET(authed("http://localhost/api/tmdb?kind=game&q=sil")));
    expect((games.results as { title: string }[])[0]?.title).toBe("Silent Hill");

    handle.restore();
    handle = installApi([sessionStep()], {
      fetch: () => new Response("nope", { status: 404 }),
    });
    await expect(GET(authed("http://localhost/api/tmdb?poster=/missing.jpg"))).rejects.toThrow("That poster was not found.");
  });
});

describe("tmdb import", () => {
  it("imports movies, series, documentaries, shows, books, and games", async () => {
    handle = installApi([
      sessionStep(),
      { match: "INSERT INTO movie (title", rows: [{ id: 6 }] },
      { match: "INSERT INTO movieseries", rows: [{ id: 7 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("/collection/30")) {
          return json({ name: "Hell Collection", poster_path: "/c.jpg", parts: [] });
        }

        if (url.includes("/movie/15")) {
          return json({ title: "Hex", release_date: "1999-10-31", runtime: 90, poster_path: "/hex.jpg" });
        }

        return undefined;
      },
    });
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { tmdbId: 15 }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "series", tmdbId: 30 }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "movie", tmdbId: 0 }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "movie", tmdbId: 1.5 }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", "not-json"))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM documentary WHERE lower(title)", rows: [{ id: 4 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/movie/16") ? json({ title: "Doc", release_date: "2001-01-01", runtime: 80, poster_path: "/d.jpg" }) : undefined),
    });
    const existingDoc = await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "documentary", tmdbId: 16 })));
    expect(existingDoc).toMatchObject({ added: 0, id: "documentary:4" });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "INSERT INTO documentary", rows: [{ id: 8 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/movie/17") ? json({ title: "Doc", poster_path: "nope" }) : undefined),
    });
    const newDoc = await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "Documentary", tmdbId: 17 })));
    expect(newDoc).toMatchObject({ added: 1, id: "documentary:8" });

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO documentary", rows: [] }], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/movie/18") ? json({ title: "Doc" }) : undefined),
    });
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "documentary", tmdbId: 18 }))).status).toBe(500);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE tmdbid", rows: [{ id: 9 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/tv/40") ? json({ name: "Hex", first_air_date: "2010-01-01", number_of_episodes: 2, number_of_seasons: 1, seasons: [] }) : undefined),
    });
    expect(await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "show", tmdbId: 40 })))).toMatchObject({
      added: 0,
      id: "show:9",
    });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE tmdbid", rows: [] },
      { match: "tmdbid IS NULL", rows: [{ id: 11 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/tv/41") ? json({ name: "Hex", seasons: [{ season_number: 1, name: "One" }] }) : undefined),
    });
    expect(await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "show", tmdbId: 41 })))).toMatchObject({
      added: 0,
      id: "show:11",
    });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE tmdbid", error: "missing show" },
      { match: "INSERT INTO show", rows: [{ id: 12 }] },
      { match: "UPDATE show SET tmdbid = $1, releaseyear", error: "cannot attach" },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/tv/42") ? json({ name: "Hex", number_of_episodes: "nope", number_of_seasons: -1 }) : undefined),
    });
    expect(await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "show", tmdbId: 42 })))).toMatchObject({
      added: 1,
      id: "show:12",
    });

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO show", rows: [] }], {
      env: { TMDBKey: "key" },
      fetch: (url) => (url.includes("/tv/43") ? json({ name: "Hex" }) : undefined),
    });
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "show", tmdbId: 43 }))).status).toBe(500);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "INSERT INTO book", rows: [{ id: 3 }] },
    ], {
      fetch: (url) => {
        if (url.includes("/works/OL1W.json")) {
          return json({ title: "Dracula", description: "A classic." });
        }

        if (url.includes("openlibrary.org/search")) {
          return json({ docs: [{ key: "/works/OL1W", title: "Dracula", first_publish_year: 1897 }] });
        }

        return undefined;
      },
    });
    expect(await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "book", sourceId: "OL1W" })))).toMatchObject({
      id: "book:3",
    });
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "book", sourceId: "nope" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO game", rows: [{ id: 4 }] }], {
      env: { IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "secret" },
      fetch: (url) => (url.includes("api.igdb.com") ? json([{ id: 10, name: "Silent Hill" }]) : undefined),
    });
    expect(await readBody(await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "game", sourceId: "10" })))).toMatchObject({
      id: "game:4",
    });
    expect((await POST(jsonCall("http://localhost/api/tmdb", "POST", { kind: "game", sourceId: "nope" }))).status).toBe(400);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/tmdb?q=hex"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not talk to TMDb." });
  });
});
