import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "./lists";
import { authed, installApi, jsonCall, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const listRows = [
  { id: 3, name: "Midnight", visibility: "public", media_kind: "movie", media_id: 4 },
  { id: 3, name: "Midnight", visibility: "PUBLIC", media_kind: null, media_id: 5 },
  { id: 4, name: null, visibility: "nope", media_kind: "show", media_id: null },
  { id: 4, name: "Quiet", visibility: null, media_kind: "book", media_id: 2 },
];

function owned(count = 0, extra: { match: string; rows?: Record<string, unknown>[]; error?: string; once?: boolean }[] = []) {
  return [sessionStep(), { match: "SELECT 1 FROM user_list WHERE id", rows: [{ "?column?": 1 }] }, { match: "COUNT(*)::int AS count FROM user_list_item", rows: [{ count }] }, ...extra];
}

describe("lists", () => {
  it("requires a session and returns grouped lists", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/lists", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await GET(authed("http://localhost/api/lists"))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM user_list l", rows: listRows }]);
    const body = await readBody(await GET(authed("http://localhost/api/lists")));
    expect(body.lists).toEqual([
      { id: 3, name: "Midnight", items: ["movie:4"], visibility: "public" },
      { id: 4, name: "", items: ["book:2"], visibility: "private" },
    ]);
  });

  it("creates, renames, and shares a list", async () => {
    handle = installApi([sessionStep(), { match: "COUNT(*)::int AS count FROM user_list WHERE", rows: [{ count: 39 }] }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "  Midnight  " }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "A" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "COUNT(*)::int AS count FROM user_list WHERE", rows: [{}] }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "x".repeat(80) }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "COUNT(*)::int AS count FROM user_list WHERE", rows: [{ count: 40 }] }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "Extra" }))).status).toBe(400);

    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "  " }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "y".repeat(81) }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", {}))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO user_list", error: "duplicate key value" }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "Midnight" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO user_list", error: "user_list_user_name_idx" }]);
    const named = await POST(jsonCall("http://localhost/api/lists", "POST", { name: "Midnight" }));
    expect(await readBody(named)).toEqual({ error: "You already have a list with that name." });

    handle.restore();
    handle = installApi([sessionStep(), { match: "INSERT INTO user_list", error: "syntax error" }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { name: "Midnight" }))).status).toBe(500);

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: "SET visibility", rows: [{ id: 3 }] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 3, visibility: " PUBLIC " }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { listId: 3, visibility: "private" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SET visibility", rows: [] }]);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 9, visibility: "public" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SET name = $1 WHERE", rows: [{ id: 3 }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 3, name: "Later" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SET name = $1, visibility", rows: [{ id: 3 }] }]);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 3, name: "Later", visibility: "public" }))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SET name = $1 WHERE", rows: [] }]);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 3, name: "Later" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SET name", error: "duplicate key" }]);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 3, name: "Later" }))).status).toBe(400);

    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { visibility: "shared" }))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 0, name: "Later" }))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/lists", "PATCH", { id: 1.5, name: "Later" }))).status).toBe(400);
  });

  it("adds and removes titles, series, and franchises", async () => {
    handle = installApi(owned(199));
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, itemId: "movie:4" }))).status).toBe(200);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { id: 3, itemId: "series:2" }))).status).toBe(200);

    handle.restore();
    handle = installApi(owned(200));
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, itemId: "movie:4" }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "SELECT 1 FROM user_list WHERE id", rows: [] }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, itemId: "movie:4" }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { itemId: "podcast:1" }))).status).toBe(400);

    handle.restore();
    handle = installApi([...owned(1), { match: "SELECT $1, 'movie', id", error: "no movie table" }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, itemId: "series:2" }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      ...owned(1),
      { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 2 }] },
      { match: "media_kind = 'series'", rows: [{ media_id: 8 }, { media_id: null }] },
    ]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { id: 3, franchiseId: 5 }))).status).toBe(200);

    handle.restore();
    handle = installApi([...owned(200), { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 1 }] }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, franchiseId: 5 }))).status).toBe(400);

    handle.restore();
    handle = installApi([...owned(1), { match: "COUNT(*)::int AS count FROM franchise_item", rows: [{ count: 0 }] }]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, franchiseId: 5 }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, franchiseId: 0 }))).status).toBe(400);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", { listId: 3, franchiseId: 1.2 }))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "DELETE FROM user_list WHERE", rows: [{ id: 3 }] }]);
    expect((await DELETE(authed("http://localhost/api/lists?id=3"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "DELETE FROM user_list WHERE", rows: [] }]);
    expect((await DELETE(authed("http://localhost/api/lists?id=3"))).status).toBe(400);
    expect((await DELETE(authed("http://localhost/api/lists"))).status).toBe(400);

    handle.restore();
    handle = installApi(owned());
    expect((await DELETE(authed("http://localhost/api/lists?listId=3&itemId=movie:4"))).status).toBe(200);
    expect((await DELETE(authed("http://localhost/api/lists?listId=3&itemId=series:2"))).status).toBe(200);

    handle.restore();
    handle = installApi([...owned(), { match: "IN (SELECT id FROM movie WHERE seriesid", error: "no movie table" }]);
    expect((await DELETE(authed("http://localhost/api/lists?listId=3&itemId=series:2"))).status).toBe(200);

    handle.restore();
    handle = installApi([
      ...owned(),
      { match: "media_kind = 'series'", rows: [{ media_id: 8 }] },
    ]);
    expect((await DELETE(authed("http://localhost/api/lists?id=3&franchiseId=5"))).status).toBe(200);
    expect((await DELETE(authed("http://localhost/api/lists?listId=3&franchiseId=5"))).status).toBe(200);

    handle.restore();
    handle = installApi(owned());
    expect((await DELETE(authed("http://localhost/api/lists?franchiseId=0&listId=3"))).status).toBe(400);
  });

  it("rejects invalid JSON and a database error", async () => {
    handle = installApi([sessionStep()]);
    expect((await POST(jsonCall("http://localhost/api/lists", "POST", "not-json"))).status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(), { match: "FROM user_list l", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/lists"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not update your library." });
  });
});
