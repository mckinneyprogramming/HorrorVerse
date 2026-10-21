import { afterEach, describe, expect, it } from "vitest";
import { DELETE as deleteAuth, PATCH as patchAuth, POST as postAuth, denyMissingUser, errorText, verifyPassword } from "./auth";
import { GET as getCatalog, POST as postCatalog } from "./catalog";
import { catalogCoverage } from "./catalog";
import { POST as postFranchise, duplicateNameError } from "./franchises";
import { GET as getLists, PATCH as patchLists, duplicateListError } from "./lists";
import { GET as getPeople, PATCH as patchPeople } from "./people";
import { GET as getShows, PATCH as patchShows } from "./shows";
import { GET as getSync, filmYear, refreshMissingKeywords } from "./sync";
import { GET as getTmdb, POST as postTmdb } from "./tmdb";
import { collectIds, upcomingFailure } from "./upcoming";
import { GET as getWatch } from "./watch";
import { requireDatabaseUrl } from "../lib/neon";
import { adminRow, authed, installApi, jsonCall, memberRow, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("remaining handler branches", () => {
  it("covers auth null fields, logout failures, and password edge cases", async () => {
    expect(errorText(new Error("duplicate key"))).toBe("duplicate key");
    expect(errorText("plain")).toBe("");
    expect(() => denyMissingUser(null)).toThrow("Invalid email or password.");
    expect(denyMissingUser({ id: 1, email: "member@example.com", displayName: "Member", isAdmin: false }).displayName).toBe("Member");
    await expect(verifyPassword("vault-key", "pbkdf2$sha256$2147483648$YQ==$YQ==")).resolves.toBe(false);

    handle = installApi();
    expect((await postAuth(jsonCall("http://localhost/api/auth", "POST", { action: "register", email: "member@example.com" }, null))).status).toBe(400);

    handle.restore();
    handle = installApi([{ match: "DELETE FROM app_session", error: "db down" }]);
    expect((await deleteAuth(authed("http://localhost/api/auth", { method: "DELETE" }))).status).toBe(500);

    handle.restore();
    handle = installApi([sessionStep({ id: 1, email: "member@example.com", is_admin: false })]);
    const nameless = await patchAuth(jsonCall("http://localhost/api/auth", "PATCH", { aboutMe: "Hi" }));
    expect(nameless.status).toBe(400);
    expect(await readBody(nameless)).toEqual({ error: "Enter a display name." });

    handle.restore();
    handle = installApi([
      sessionStep({ id: 1, email: "member@example.com", display_name: "Member", is_admin: false }),
      { match: "UPDATE app_user", rows: [{ id: 1, is_admin: false }] },
    ]);
    const cleared = await readBody(await patchAuth(jsonCall("http://localhost/api/auth", "PATCH", { displayName: "Member", aboutMe: null, avatar: null })));
    expect(cleared.user).toMatchObject({ id: 1, email: "", displayName: "" });

    handle.restore();
    handle = installApi([
      sessionStep({ id: 1, email: "member@example.com", display_name: "Member", is_admin: false }),
      { match: "UPDATE app_user", rows: [{ id: 1, email: "member@example.com", display_name: "Member", is_admin: false }] },
    ]);
    const kept = await patchAuth(jsonCall("http://localhost/api/auth", "PATCH", { displayName: "Member" }));
    expect(kept.status).toBe(200);
  });

  it("covers catalog defaults and missing optional values", async () => {
    const connectionString = "postgresql://horror:secret@ep-test.neon.tech/HorrorVerse";
    expect(() => catalogCoverage.insertSql("opera")).toThrow("That type cannot be stored yet.");
    expect(() => catalogCoverage.existingIdSql("opera")).toThrow("That type cannot be stored yet.");
    expect(() => catalogCoverage.insertParams("opera", "Title", {})).toThrow("That type cannot be stored yet.");
    expect(() => catalogCoverage.updateSql("opera")).toThrow("That type cannot be stored yet.");
    expect(() => catalogCoverage.deleteSql("opera")).toThrow("That type cannot be stored yet.");

    handle = installApi([{ match: "FROM game", rows: [{ releaseyear: 1999 }] }]);
    await expect(catalogCoverage.currentYear(connectionString, "opera", 1)).resolves.toBe(0);
    await expect(catalogCoverage.currentYear(connectionString, "game", 5)).resolves.toBe(1999);
    expect(handle.calls.some((call) => call.query.includes("FROM game"))).toBe(true);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "INSERT INTO show", rows: [{ id: 5, completed: false }] }]);
    expect((await postCatalog(jsonCall("http://localhost/api/catalog", "POST", { kind: "show", title: "Show", totalEpisodes: 0 }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "INSERT INTO book", rows: [{ id: 5 }] }]);
    const book = await readBody(await postCatalog(jsonCall("http://localhost/api/catalog", "POST", { kind: "book", title: "Book", pages: 0 })));
    expect(book.title).toBe("");

    handle.restore();
    handle = installApi([sessionStep(adminRow)]);
    expect((await postCatalog(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie" }))).status).toBe(400);

    handle.restore();
    handle = installApi([{ match: "FROM media_keyword", rows: [{ media_id: 1, name: "Slash" }, { media_kind: "movie", media_id: 1, name: "Slash" }] }]);
    expect((await getCatalog()).status).toBe(200);
  });

  it("covers franchise and list defensive branches", async () => {
    expect(duplicateNameError("nope").message).toBe("Could not save that franchise.");
    expect(duplicateNameError(new Error("syntax")).message).toBe("syntax");
    expect(duplicateListError("nope").message).toBe("Could not save that list.");
    expect(duplicateListError(new Error("syntax")).message).toBe("syntax");

    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] },
      { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 1 }] },
    ]);
    expect((await postFranchise(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "series:7" }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] },
      { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 1 }] },
      { match: "WHERE seriesid = $2", error: "no movie table" },
    ]);
    expect((await postFranchise(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "series:7" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep()]);
    const shared = await patchLists(jsonCall("http://localhost/api/lists", "PATCH", { id: 3, visibility: "shared" }));
    expect(shared.status).toBe(400);
    expect(await readBody(shared)).toEqual({ error: "A list is either private or public." });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "FROM user_list l", rows: [{ id: 8, name: "Bare", media_kind: "movie", media_id: 1 }] },
    ]);
    const lists = await readBody(await getLists(authed("http://localhost/api/lists")));
    expect(lists.lists).toEqual([expect.objectContaining({ id: 8, visibility: "private" })]);
  });

  it("covers people names, list visibility, and a missing friend action", async () => {
    handle = installApi([
      sessionStep(),
      { match: "display_name ILIKE", rows: [{ id: 9 }, { id: 3, displayName: "Ghost" }] },
      { match: "COUNT(*)::int AS count", rows: [{ count: 0 }] },
    ]);
    const searched = await readBody(await getPeople(authed("http://localhost/api/people?q=ghost")));
    expect((searched.people as { displayName: string }[])[0]?.displayName).toBe("");

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id, display_name, about_me, avatar FROM app_user WHERE id", rows: [{ id: 1, display_name: "Member" }] },
      { match: "FROM user_list l", rows: [{ id: 11, name: "Hidden", media_kind: "movie", media_id: 1 }] },
      { match: "FROM user_media_progress", rows: [] },
    ]);
    const self = await readBody(await getPeople(authed("http://localhost/api/people?id=1")));
    expect((self.person as { lists: { visibility: string }[] }).lists[0]?.visibility).toBe("private");

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT 1 FROM app_user WHERE id", rows: [{ "?column?": 1 }] }]);
    await expect(patchPeople(jsonCall("http://localhost/api/friends", "PATCH", { userId: 2 }))).rejects.toThrow(
      "Choose accept, decline, or cancel.",
    );
  });

  it("covers show ids, blank titles, and partial TMDb seasons", async () => {
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "AS missing", rows: [{}] },
      { match: "AS episode_count", rows: [] },
    ]);
    expect((await patchShows(jsonCall("http://localhost/api/shows", "PATCH", { episodeId: null, seasonId: null, id: "show:4", completed: true }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{}] },
      { match: "SELECT title, releaseyear FROM show", rows: [{ title: "A" }] },
      { match: "AS episode_count", rows: [{ id: 7, season_number: 1 }] },
      { match: "AS progress_id", rows: [{ id: 1, episode_number: 1, runtime: 12 }] },
    ]);
    const guide = await readBody(await getShows(authed("http://localhost/api/shows?id=show:4")));
    expect((guide.seasons as { title: string; episodes: { title: string }[] }[])[0]).toMatchObject({ title: "", episodes: [{ title: "" }] });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
      { match: "SELECT id FROM show_season WHERE show_id = $1 AND season_number", rows: [{ id: 7 }] },
      { match: "COUNT(*)::int AS count FROM show_episode", rows: [{ count: 1 }] },
      { match: "AS episode_count", rows: [] },
    ], {
      env: { TMDBKey: "key" },
      external: [
        { match: "/season/", body: { episodes: "nope" } },
        { match: "/tv/", body: { seasons: "nope" } },
      ],
    });
    expect((await getShows(authed("http://localhost/api/shows?id=show:4&season=1"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 4 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
      { match: "SELECT id FROM show_season WHERE show_id = $1 AND season_number", rows: [{ id: 7 }] },
      { match: "COUNT(*)::int AS count FROM show_episode", rows: [{ count: 0 }] },
      { match: "AS episode_count", rows: [] },
    ], {
      env: { TMDBKey: "key" },
      external: [
        { match: "/season/", body: { episodes: [{ episode_number: 1, runtime: 20 }] } },
        { match: "/tv/", body: { seasons: [{ season_number: 3 }] } },
      ],
    });
    expect((await getShows(authed("http://localhost/api/shows?id=show:4&season=1"))).status).toBe(200);
  });

  it("stores a documentary TMDb id and ignores blank watch fields", async () => {
    handle = installApi([
      sessionStep(),
      { match: "FROM documentary WHERE id", rows: [{ title: "Hex", releaseyear: 1999 }] },
    ], {
      env: { TMDBKey: "key" },
      external: [
        { match: "/search/movie", body: { results: [{ id: 6, release_date: "1999-05-01" }, { id: 8, title: "Hex", release_date: "1999-05-01" }] } },
        { match: "/watch/providers", body: { results: { US: { flatrate: [{ provider_id: 4 }] } } } },
      ],
    });
    const saved = await readBody(await getWatch(authed("http://localhost/api/watch?id=documentary:3")));
    expect(saved.title).toBe("Hex");
    expect(handle.calls.some((call) => call.query.includes("UPDATE documentary SET tmdbid"))).toBe(true);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM movie WHERE id", rows: [{ tmdbid: 1 }] }]);
    expect((await getWatch(authed("http://localhost/api/watch?id=movie:9"))).status).toBe(404);
  });

  it("covers TMDb blank search fields and an empty show insert", async () => {
    handle = installApi([sessionStep()], {
      env: { TMDBKey: "key" },
      external: [{ match: "/search/movie", body: { results: [{ id: 9, genre_ids: [27] }, { id: 10, genre_ids: [99] }] } }],
    });
    expect((await getTmdb(authed("http://localhost/api/tmdb?kind=movie&q=hex"))).status).toBe(200);
    expect((await getTmdb(authed("http://localhost/api/tmdb?kind=documentary&q=hex"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep()], {
      env: { TMDBKey: "key" },
      external: [{ match: "/search/tv", body: { results: [{ id: 9, genre_ids: [27] }] } }],
    });
    expect((await getTmdb(authed("http://localhost/api/tmdb?kind=show&q=hex"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep()], {
      env: { TMDBKey: "key" },
      external: [{ match: "/search/collection", body: { results: [{ id: 9 }, { id: 0, name: "Nope" }] } }],
    });
    expect((await getTmdb(authed("http://localhost/api/tmdb?kind=series&q=hex"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await postTmdb(jsonCall("http://localhost/api/tmdb", "POST", { kind: "book" }))).status).toBeGreaterThanOrEqual(400);
    expect((await postTmdb(jsonCall("http://localhost/api/tmdb", "POST", { kind: "game" }))).status).toBeGreaterThanOrEqual(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO show", rows: [] }], {
      env: { TMDBKey: "key" },
      external: [{ match: "/tv/", body: { name: "Hex", first_air_date: "2010-01-01" } }],
    });
    const failed = await postTmdb(jsonCall("http://localhost/api/tmdb", "POST", { kind: "show", tmdbId: 15 }));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not save that show." });
  });

  it("walks sync paths that only appear for existing films and scoped keywords", async () => {
    expect(filmYear(undefined)).toBe(0);
    expect(filmYear(1996)).toBe(1996);

    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 3, title: "Scream", tmdbid: 77 }] },
      { match: "lower(title) = lower($1) AND releaseyear", rows: [{ id: 4 }], once: true },
      { match: "lower(title) = lower($1) AND releaseyear", rows: [] },
      { match: "INSERT INTO movie (title, totaltime, partofseries", rows: [{ id: 9 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("/collection/77")) {
          return json({
            parts: [
              { id: 10, title: "Scream", release_date: "1996-12-20" },
              { id: 11, title: "Scream 2", release_date: "1997-12-12" },
            ],
          });
        }

        if (url.includes("/movie/10")) {
          return json({ title: "Scream", release_date: "1996-12-20", runtime: 111 });
        }

        if (url.includes("/movie/11")) {
          return json({ title: "Scream 2", release_date: "1997-12-12", runtime: 120 });
        }

        return json({ keywords: [] });
      },
    });
    expect((await getSync(authed("http://localhost/api/sync?id=series:3"))).status).toBe(200);
    expect(handle.calls.some((call) => call.query.includes("partofseries = TRUE"))).toBe(true);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 3, tmdbid: 12 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: () => json({ parts: [] }),
    });
    expect((await getSync(authed("http://localhost/api/sync?id=series:3"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 3, title: "Ghosts" }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: (url) => {
        if (url.includes("/search/collection")) {
          return json({ results: [{ id: 1 }, { id: 2, name: "Other" }, { id: 4, name: "Ghosts" }] });
        }

        if (url.includes("/collection/4")) {
          return json({ parts: [{ genre_ids: [18] }] });
        }

        return json({ results: [{ title: "Nope" }] });
      },
    });
    expect(await readBody(await getSync(authed("http://localhost/api/sync?id=series:3")))).toMatchObject({ added: 0 });

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT id FROM movieseries ORDER BY id", rows: [{ id: 5 }, { id: 6 }] },
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", rows: [{ id: 5, title: "A" }], once: true },
      { match: "SELECT id, title, tmdbid FROM movieseries WHERE id", error: "gone", once: true },
      { match: "SELECT id FROM show ORDER BY id", rows: [{ id: 8 }, { id: 9 }] },
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 8 }], once: true },
      { match: "SELECT id FROM show WHERE id = $1", error: "gone", once: true },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'series'", error: "no progress" },
    ], { env: { TMDBKey: "key" } });
    expect((await getSync(authed("http://localhost/api/sync"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(memberRow),
      { match: "SELECT id FROM show WHERE id = $1", rows: [{ id: 2 }] },
      { match: "SELECT tmdbid FROM show WHERE id = $1", rows: [{ tmdbid: 99 }] },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [], once: true },
      { match: "SELECT season_number FROM show_season WHERE show_id = $1", rows: [{ season_number: 1 }] },
      { match: "DELETE FROM user_media_progress WHERE media_kind = 'show'", error: "no progress" },
      { match: "SELECT id, tmdbid FROM show ORDER BY id", rows: [{ id: 2, tmdbid: 99 }] },
    ], {
      env: { TMDBKey: "key" },
      fetch: () => json({ seasons: [{ season_number: 1, name: "One" }], number_of_episodes: 1, number_of_seasons: 1 }),
    });
    expect((await getSync(authed("http://localhost/api/sync?id=show:2"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      { match: "releaseyear, tmdbid FROM movie", rows: [] },
      {
        match: "releaseyear, tmdbid FROM documentary",
        rows: [{ id: 3, tmdbid: 21 }, { id: 8, title: "Boom", tmdbid: 22 }, { id: 5, title: "Hex" }, { id: 6 }],
      },
      { match: "SELECT 1 AS present", rows: [{ present: 1 }], once: true },
      { match: "SELECT 1 AS present", error: "no keywords", once: true },
      { match: "SELECT 1 AS present", rows: [] },
    ], {
      env: { TMDBKey: "key" },
      fetch: () => json({ results: [{ id: 1 }, { id: 2, title: "Other", release_date: "1999-01-01" }] }),
    });
    await refreshMissingKeywords(requireDatabaseUrl());

    handle.restore();
    handle = installApi([
      { match: "releaseyear, tmdbid FROM documentary", rows: [{ id: 9, title: "Other" }, { id: 3 }] },
      { match: "SELECT 1 AS present", rows: [] },
    ], { env: { TMDBKey: "key" }, fetch: () => json({ results: [] }) });
    await refreshMissingKeywords(requireDatabaseUrl(), "documentary:3");

    handle.restore();
    handle = installApi([
      { match: "releaseyear, tmdbid FROM movie", rows: [{ id: 7, title: "Other" }, { id: 6 }] },
      { match: "SELECT 1 AS present", rows: [] },
    ], { env: { TMDBKey: "key" }, fetch: () => json({ results: [{ id: 3 }] }) });
    await refreshMissingKeywords(requireDatabaseUrl(), "movie:6");

    handle.restore();
    handle = installApi([
      { match: "SELECT id, tmdbid FROM show ORDER BY id", rows: [{ id: 9 }, { id: 2, tmdbid: 30 }, { id: 3 }] },
      { match: "SELECT 1 AS present", rows: [{ present: 1 }], once: true },
      { match: "SELECT 1 AS present", rows: [] },
    ], { env: { TMDBKey: "key" } });
    await refreshMissingKeywords(requireDatabaseUrl(), "show:2");

    handle.restore();
    handle = installApi([
      { match: "SELECT id, tmdbid FROM show ORDER BY id", rows: [{ id: 4, tmdbid: 31 }] },
      { match: "SELECT 1 AS present", error: "no keywords" },
    ], { env: { TMDBKey: "key" } });
    await refreshMissingKeywords(requireDatabaseUrl(), "show:4");
  });

  it("asks the episode collector for a path without a query string", async () => {
    expect(upcomingFailure(new Error("TMDBKey is not configured."))).toContain("TMDBKey");
    expect(upcomingFailure("offline")).toBe("Could not load upcoming titles.");

    handle = installApi([], { env: { TMDBKey: "key" }, fetch: () => json({}, 404) });
    const ids = new Set<number>();
    await collectIds("/tv/on_the_air", 1, ids, false);
    expect(ids.size).toBe(0);
  });
});
