import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "./franchises";
import { adminRow, authed, installApi, jsonCall, memberRow, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const rows = [
  { id: 2, name: "Conjure", media_kind: "movie", media_id: 4 },
  { id: 2, name: "Conjure", media_kind: null, media_id: 5 },
  { id: 3, name: null, media_kind: "book", media_id: null },
  { id: 3, name: "Quiet", media_kind: "show", media_id: 8 },
];

describe("franchises", () => {
  it("lists franchises and reports database failures", async () => {
    handle = installApi([{ match: "FROM franchise f", rows }]);
    const body = await readBody(await GET());
    expect(body.franchises).toEqual([
      { id: 2, name: "Conjure", items: ["movie:4"] },
      { id: 3, name: "", items: ["show:8"] },
    ]);

    handle.restore();
    handle = installApi([{ match: "franchise_name_idx", error: "expression indexes are unsupported" }]);
    expect((await GET()).status).toBe(200);

    handle.restore();
    handle = installApi([{ match: "FROM franchise f", error: "db down" }]);
    const failed = await GET();
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not update franchises." });

    handle.restore();
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    expect((await GET()).status).toBe(503);
  });

  it("lets an admin create, rename, and delete a franchise", async () => {
    handle = installApi();
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Conjure" }, null))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep(memberRow)]);
    const member = await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Conjure" }));
    expect(member.status).toBe(403);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Conjure" }))).status).toBe(401);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "COUNT(*)::int AS count FROM franchise", rows: [{ count: 79 }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "  Conjure  " }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "COUNT(*)::int AS count FROM franchise", rows: [{}] }]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "A" }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "x".repeat(80) }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "COUNT(*)::int AS count FROM franchise", rows: [{ count: 80 }] }]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Extra" }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", {}))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "  " }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "y".repeat(81) }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", "not-json"))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "INSERT INTO franchise (name)", error: "duplicate key value" }]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Conjure" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "INSERT INTO franchise (name)", error: "franchise_name_idx" }]);
    expect(await readBody(await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Conjure" })))).toEqual({
      error: "A franchise with that name already exists.",
    });

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "INSERT INTO franchise (name)", error: "syntax error" }]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { name: "Conjure" }))).status).toBe(500);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "UPDATE franchise SET name", rows: [{ id: 2 }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/franchises", "PATCH", { id: 2, name: "Later" }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/franchises", "PATCH", { franchiseId: 2, name: "Later" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "UPDATE franchise SET name", rows: [] }]);
    expect((await PATCH(jsonCall("http://localhost/api/franchises", "PATCH", { id: 2, name: "Later" }))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/franchises", "PATCH", { name: "Later" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "UPDATE franchise SET name", error: "duplicate key" }]);
    expect((await PATCH(jsonCall("http://localhost/api/franchises", "PATCH", { id: 2, name: "Later" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "DELETE FROM franchise WHERE", rows: [{ id: 2 }] }]);
    expect((await DELETE(authed("http://localhost/api/franchises?id=2"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "DELETE FROM franchise WHERE", rows: [] }]);
    expect((await DELETE(authed("http://localhost/api/franchises?id=9"))).status).toBe(400);
    expect((await DELETE(authed("http://localhost/api/franchises"))).status).toBe(400);
  });

  it("adds and removes franchise titles, including series movies", async () => {
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] },
      { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 199 }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { franchiseId: 2, itemId: "movie:4" }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "book:3" }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "show:5" }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "game:6" }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] },
      { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 1 }] },
      { match: "SELECT $1, 'movie', id", error: "no movie table" },
    ]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "series:7" }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] },
      { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 200 }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "movie:4" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "SELECT 1 FROM franchise WHERE id", rows: [] }]);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 2, itemId: "movie:4" }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { itemId: "podcast:1" }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/franchises", "POST", { id: 0, itemId: "movie:4" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(adminRow), { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] }]);
    expect((await DELETE(authed("http://localhost/api/franchises?franchiseId=2&itemId=movie:4"))).status).toBe(200);
    expect((await DELETE(authed("http://localhost/api/franchises?id=2&itemId=series:7"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(adminRow),
      { match: "SELECT 1 FROM franchise WHERE id", rows: [{ "?column?": 1 }] },
      { match: "IN (SELECT id FROM movie WHERE seriesid", error: "no movie table" },
    ]);
    expect((await DELETE(authed("http://localhost/api/franchises?id=2&itemId=series:7"))).status).toBe(200);
    expect((await DELETE(authed("http://localhost/api/franchises?itemId=movie:4"))).status).toBe(400);
  });
});
