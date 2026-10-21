import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "./catalog";
import { adminRow, authed, installApi, jsonCall, memberRow, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const openCover = "https://covers.openlibrary.org/b/id/9-M.jpg";
const igdbCover = "https://images.igdb.com/igdb/image/upload/t_cover_big/abc_1.jpg";
const legacyCover = "https://images.igdb.com/igdb/image/t_cover_big/def-2.jpg";

const movieRows = [
  {
    id: 1,
    title: "Hex",
    completed: true,
    totaltime: 96,
    releaseyear: "1999",
    seriesid: 4,
    seriestitle: " Saga ",
    posterpath: "/hex.jpg",
    totalepisodes: "8",
    numberofseasons: 2,
    pages: 320,
    author: " King ",
    developer: " Dev ",
    platforms: " PC ",
    description: " A fog story ",
    coverurl: openCover,
    isbn: " 123 ",
    publisher: " Press ",
  },
  {
    id: 2,
    title: "Camel",
    completed: 0,
    totalTime: 12,
    releaseYear: 2001,
    seriesId: 3,
    seriesTitle: "Trail",
    posterPath: "/camel.jpg",
    totalEpisodes: 1,
    numberOfSeasons: 1,
    coverUrl: igdbCover,
  },
  {
    id: 3,
    title: "",
    completed: false,
    totaltime: 0,
    releaseyear: 0,
    seriesid: 0,
    seriestitle: "   ",
    posterpath: "nope",
    totalepisodes: 0,
    numberofseasons: 0,
    pages: 0,
    author: "   ",
    developer: "",
    platforms: 4,
    description: "  ",
    coverurl: legacyCover,
    isbn: "",
    publisher: "   ",
  },
  { id: 4, title: "Bare", completed: false, coverurl: "https://example.com/nope.jpg", author: 12, totaltime: "nope" },
  { id: 5, title: "Infinity", completed: false, totaltime: "Infinity", releaseyear: "", pages: "  " },
];

const keywordRows = [
  { media_kind: "", media_id: 1, name: "ghost" },
  { media_kind: "movie", media_id: 0, name: "ghost" },
  { media_kind: "movie", media_id: 1.5, name: "ghost" },
  { media_kind: "movie", media_id: 1, name: "   " },
  { media_kind: "movie", media_id: 1, name: "Ghost" },
  { media_kind: "movie", media_id: 1, name: "ghost" },
  { media_kind: "movie", media_id: 1, name: "Slasher" },
  { media_kind: "series", media_id: 9, name: null },
];

describe("catalog reads", () => {
  it("maps catalog rows and keywords", async () => {
    handle = installApi([
      { match: "LEFT JOIN movieseries", rows: movieRows },
      { match: "FROM movieseries s", rows: [{ id: 4, title: "Saga", completed: false, posterpath: "/saga.jpg" }] },
      { match: "FROM documentary", rows: [{ id: 6, title: "Doc", completed: true }] },
      { match: "posterpath FROM show", rows: [{ id: 7, title: "Show", completed: false }] },
      { match: "FROM book", rows: [{ id: 8, title: "Book", completed: false, author: "King" }] },
      { match: "FROM podcast", rows: [{ id: 9, title: "Cast", completed: true, releaseyear: 2020 }] },
      { match: "FROM game", rows: [{ id: 10, title: "Game", completed: false, developer: "Dev" }] },
      { match: "FROM media_keyword", rows: keywordRows },
    ]);
    const items = (await (await GET()).json()) as { id: string; keywords?: string[]; author?: string; coverUrl?: string }[];
    const hex = items.find((item) => item.id === "movie:1");
    expect(hex?.keywords).toEqual(["Ghost", "Slasher"]);
    expect(hex?.author).toBe("King");
    expect(hex?.coverUrl).toBe(openCover);
    const legacy = items.find((item) => item.id === "movie:3");
    expect(legacy?.coverUrl).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/def-2.jpg");
    expect(items.some((item) => item.id === "podcast:9")).toBe(true);
  });

  it("skips an optional table and keywords when Neon fails", async () => {
    handle = installApi([
      { match: "LEFT JOIN movieseries", rows: [{ id: 1, title: "Hex", completed: false }] },
      { match: "FROM podcast", error: "no podcast table" },
      { match: "FROM media_keyword", error: "no keyword table" },
    ]);
    const items = (await (await GET()).json()) as { id: string; keywords?: string[] }[];
    expect(items.some((item) => item.id === "movie:1")).toBe(true);
    expect(items.some((item) => item.id.startsWith("podcast:"))).toBe(false);
    expect(items[0]?.keywords).toBeUndefined();
  });

  it("reports a missing database and a failed read", async () => {
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    const missing = await GET();
    expect(missing.status).toBe(503);

    handle.restore();
    handle = installApi([{ match: "LEFT JOIN movieseries", error: "db down" }]);
    const failed = await GET();
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Catalog unavailable." });
  });
});

describe("catalog writes", () => {
  it("splits administrators from members", async () => {
    handle = installApi();
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex" }, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex" }))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep(memberRow)]);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex" }))).status).toBe(403);

    handle.restore();
    handle = installApi([sessionStep({ email: "member@example.com", is_admin: false })]);
    process.env.ADMIN_EMAIL = " member@example.com ";
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex" }))).status).not.toBe(403);

    handle.restore();
    handle = installApi([sessionStep({ email: "member@example.com", isAdmin: true })]);
    delete process.env.ADMIN_EMAIL;
    expect((await PATCH(jsonCall("http://localhost/api/catalog", "PATCH", { id: "movie:1", title: "Hex" }))).status).not.toBe(403);

    handle.restore();
    handle = installApi([sessionStep({ is_admin: false })]);
    process.env.ADMIN_EMAIL = "";
    expect((await DELETE(jsonCall("http://localhost/api/catalog", "DELETE", { id: "movie:1" }))).status).toBe(403);

    handle.restore();
    handle = installApi([sessionStep({ email: "member@example.com", is_admin: false })]);
    process.env.ADMIN_EMAIL = "other@example.com";
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex" }))).status).toBe(403);
  });

  it("inserts every stored kind and rejects bad input", async () => {
    const year = new Date().getUTCFullYear();
    const cases: { kind: string; body: Record<string, unknown>; table: string }[] = [
      { kind: "movie", table: "INSERT INTO movie", body: { title: " Hex ", totalTime: 90, releaseYear: 1999, completed: true } },
      { kind: "series", table: "INSERT INTO movieseries", body: { title: "Saga", totalTime: -1, totalMovies: 4, releaseYear: 0 } },
      { kind: "documentary", table: "INSERT INTO documentary", body: { title: "Doc", totalTime: "nope", totalMovies: -3 } },
      { kind: "show", table: "INSERT INTO show", body: { title: "Show", totalEpisodes: 2, numberOfSeasons: 1, totalMovies: 0 } },
      { kind: "book", table: "INSERT INTO book", body: { title: "Book", pages: 12 } },
      { kind: "podcast", table: "INSERT INTO podcast", body: { title: "Cast", completed: false } },
      { kind: "game", table: "INSERT INTO game", body: { kind: " GAME ", title: "Play" } },
    ];
    for (const entry of cases) {
      handle?.restore();
      handle = installApi([
        sessionStep(adminRow),
        { match: entry.table, rows: [{ id: 5, title: entry.body.title, completed: Boolean(entry.body.completed) }] },
      ]);
      const response = await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: entry.kind, ...entry.body }));
      expect(response.status, entry.kind).toBe(200);
      const insert = handle.calls.find((call) => call.query.includes(entry.table));
      expect(insert?.params[0]).toBe(String(entry.body.title).trim() === "Play" ? "Play" : String(entry.body.title).trim() || entry.body.title);
    }

    handle?.restore();
    handle = installApi([sessionStep(adminRow)]);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "opera", title: "No" }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "  " }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "z".repeat(201) }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", "not-json"))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "x".repeat(200), releaseYear: year }))).status).toBe(500);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "lower(title)", rows: [{ id: 8 }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex", releaseYear: 1999 }))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "lower(title)", rows: [{ id: 0 }, { id: "nope" }] },
      { match: "INSERT INTO movie", rows: [{ id: 5, title: "Hex", completed: false }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "series", title: "Saga" }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "lower(title)", error: "missing table" },
      { match: "INSERT INTO documentary", rows: [{ id: 6, title: "Doc", completed: false }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "documentary", title: "Doc" }))).status).toBe(200);

    const movieInsert = installApi([
      sessionStep(adminRow),
      { match: "INSERT INTO movie", rows: [{ id: 5, title: "Hex", completed: false }] },
    ]);
    handle?.restore();
    handle = movieInsert;
    await POST(jsonCall("http://localhost/api/catalog", "POST", { kind: "movie", title: "Hex", totalTime: 0, totalMovies: "nope", pages: -4, totalEpisodes: "nope", numberOfSeasons: -1 }));
    expect(year).toBeGreaterThan(2000);
  });

  it("updates and deletes every kind", async () => {
    const kinds = ["movie", "series", "documentary", "show", "book", "podcast", "game"] as const;
    for (const kind of kinds) {
      handle?.restore();
      handle = installApi([
        sessionStep(adminRow),
        { match: "SELECT releaseyear", rows: [{ releaseyear: kind === "documentary" ? "nope" : 1999 }] },
        { match: `UPDATE ${kind === "series" ? "movieseries" : kind}`, rows: [{ id: 5, title: "Next", completed: true }] },
      ]);
      const response = await PATCH(jsonCall("http://localhost/api/catalog", "PATCH", { id: `${kind}:5`, title: " Next ", completed: true }));
      expect(response.status, kind).toBe(200);
    }

    handle?.restore();
    handle = installApi([sessionStep(adminRow), { match: "SELECT releaseyear", rows: [{}] }, { match: "UPDATE movie", rows: [] }]);
    expect((await PATCH(jsonCall("http://localhost/api/catalog", "PATCH", { id: "movie:5", title: "Next" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "SELECT releaseyear", error: "missing year" }, { match: "UPDATE show", rows: [{ id: 5, title: "Next", completed: false }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/catalog", "PATCH", { id: "show:5", title: "Next" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "lower(title)", rows: [{ id: 9 }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/catalog", "PATCH", { id: "book:5", title: "Next" }))).status).toBe(400);

    for (const kind of kinds) {
      handle?.restore();
      handle = installApi([sessionStep(adminRow)]);
      const response = await DELETE(authed(`http://localhost/api/catalog?id=${kind}:5`, { method: "DELETE" }));
      expect(response.status, kind).toBe(200);
    }

    handle?.restore();
    handle = installApi([sessionStep(adminRow), { match: "DELETE FROM user_media_progress", error: "no progress" }]);
    expect((await DELETE(jsonCall("http://localhost/api/catalog", "DELETE", { id: "movie:5" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "DELETE FROM media_keyword", error: "no keywords" }]);
    expect((await DELETE(jsonCall("http://localhost/api/catalog", "DELETE", {}))).status).toBe(400);
    expect((await DELETE(authed("http://localhost/api/catalog?id=show:5", { method: "DELETE" }))).status).toBe(200);
  });
});
