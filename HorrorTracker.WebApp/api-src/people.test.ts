import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "./people";
import { authed, installApi, jsonCall, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const profile = "SELECT id, display_name, about_me, avatar FROM app_user WHERE id";
const otherUser = "SELECT 1 FROM app_user WHERE id";
const friendship = "SELECT 1 FROM user_friendship WHERE user_id = $1 AND friend_id = $2";
const request = "SELECT 1 FROM user_friend_request WHERE requester_id = $1 AND addressee_id = $2";
const follow = "AND following_id = $2";

function found(id = 2, row: Record<string, unknown> = { id, display_name: "Pal", about_me: " hey ", avatar: " pic " }) {
  return [
    sessionStep(),
    { match: otherUser, rows: [{ "?column?": 1 }] },
    { match: profile, rows: [row] },
  ];
}

describe("people search and profiles", () => {
  it("requires a session and searches by name", async () => {
    handle = installApi();
    expect((await GET(authed("http://localhost/api/people?q=pa", {}, null))).status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    expect((await GET(authed("http://localhost/api/people?q=pa"))).status).toBe(401);

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await GET(authed("http://localhost/api/people"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/people?q=a"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/people?q=%20a%20"))).status).toBe(400);

    handle.restore();
    handle = installApi([
      sessionStep(),
      {
        match: "display_name ILIKE",
        rows: [
          { id: 2, display_name: "Pal", about_me: " hey ", avatar: " pic " },
          { id: 3, displayName: "Ghost", aboutMe: "boo" },
          { id: 4, display_name: "Quiet" },
        ],
      },
      { match: friendship, rows: [{ "?column?": 1 }] },
      { match: "COUNT(*)::int AS count FROM user_friendship", rows: [{ count: 2 }] },
      { match: "COUNT(*)::int AS count FROM user_follow WHERE following_id", rows: [{ count: 0 }] },
      { match: "COUNT(*)::int AS count FROM user_follow WHERE follower_id", rows: [{ count: null }] },
    ]);
    const body = await readBody(await GET(authed("http://localhost/api/people?q=%20a%25_%5C%20")));
    const people = body.people as { id: number; aboutMe?: string; relation: string; friendCount: number }[];
    expect(people.map((person) => person.id)).toEqual([2, 3, 4]);
    expect(people[0]).toMatchObject({ aboutMe: "hey", avatar: "pic", relation: "friends", friendCount: 2 });
    expect(people[2]?.aboutMe).toBeUndefined();
  });

  it("loads a profile for self, friends, followers, and strangers", async () => {
    handle = installApi([
      sessionStep(),
      { match: profile, rows: [{ id: 1, display_name: "Member", about_me: "Mine", avatar: "me" }] },
      {
        match: "FROM user_list l",
        rows: [
          { id: 7, name: "Mine", visibility: "public", media_kind: "movie", media_id: 1 },
          { id: 7, name: "Mine", visibility: "public", media_kind: null, media_id: 2 },
          { id: 8, name: null, visibility: "nope", media_kind: "book", media_id: 3 },
        ],
      },
      { match: "FROM user_media_progress", rows: [{ media_kind: "movie", media_id: 1 }] },
    ]);
    const self = await readBody(await GET(authed("http://localhost/api/people?id=1")));
    expect(self.person).toMatchObject({ id: 1, relation: "self", following: false, followedBy: false, finishedIds: ["movie:1"] });
    expect((self.person as { lists: { visibility: string; items: string[] }[] }).lists[0]).toMatchObject({
      visibility: "public",
      items: ["movie:1"],
    });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: profile, rows: [{ id: 2, display_name: "Pal" }] },
      { match: friendship, rows: [{ "?column?": 1 }] },
      { match: "visibility = 'public'", rows: [{ id: 9, name: "Shared", visibility: "public", media_kind: "show", media_id: 4 }] },
      { match: "FROM user_media_progress", rows: [] },
    ]);
    const friend = await readBody(await GET(authed("http://localhost/api/people?id=2")));
    expect(friend.person).toMatchObject({ relation: "friends", lists: [{ id: 9, items: ["show:4"] }] });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: profile, rows: [{ id: 2, display_name: "Pal" }] },
      { match: friendship, rows: [] },
      { match: request, rows: [], once: true },
      { match: request, rows: [{ "?column?": 1 }] },
    ]);
    expect((await readBody(await GET(authed("http://localhost/api/people?id=2")))).person).toMatchObject({ relation: "incoming" });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: profile, rows: [{ id: 2, display_name: "Pal" }] },
      { match: friendship, rows: [] },
      { match: request, rows: [{ "?column?": 1 }] },
    ]);
    expect((await readBody(await GET(authed("http://localhost/api/people?id=2")))).person).toMatchObject({ relation: "outgoing" });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: profile, rows: [{ id: 2, display_name: "Pal" }] },
      { match: friendship, rows: [] },
      { match: follow, rows: [{ "?column?": 1 }], once: true },
      { match: follow, rows: [] },
      { match: "visibility = 'public'", rows: [] },
      { match: "FROM user_media_progress", rows: [{ media_kind: "book", media_id: 2 }] },
    ]);
    const following = await readBody(await GET(authed("http://localhost/api/people?id=2")));
    expect(following.person).toMatchObject({ relation: "none", following: true, followedBy: false, finishedIds: ["book:2"] });

    handle.restore();
    handle = installApi([sessionStep(), { match: profile, rows: [{ id: 2, display_name: "Pal" }] }]);
    const stranger = await readBody(await GET(authed("http://localhost/api/people?id=2")));
    expect(stranger.person).toMatchObject({ relation: "none", following: false });
    expect(stranger.person).not.toHaveProperty("lists");

    handle.restore();
    handle = installApi([sessionStep(), { match: profile, rows: [] }]);
    expect((await GET(authed("http://localhost/api/people?id=9"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/people?id=0"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/people?id=1.5"))).status).toBe(400);
  });
});

describe("friends and follows", () => {
  it("sends, accepts, declines, and removes friend requests", async () => {
    handle = installApi([sessionStep(), { match: otherUser, rows: [] }]);
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", { userId: 2 }))).rejects.toThrow("That member was not found.");
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", { userId: 1 }))).rejects.toThrow("That has to be someone else.");
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", { userId: 0 }))).rejects.toThrow("That member was not found.");
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", {}))).rejects.toThrow("That member was not found.");
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", "not-json"))).rejects.toThrow("That member was not found.");

    handle.restore();
    handle = installApi([...found(), { match: friendship, rows: [{ "?column?": 1 }] }]);
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", { userId: 2 }))).rejects.toThrow("You are already friends.");

    handle.restore();
    handle = installApi([...found(), { match: friendship, rows: [] }, { match: request, rows: [{ "?column?": 1 }] }]);
    expect((await POST(jsonCall("http://localhost/api/friends", "POST", { userId: 2 }))).status).toBe(200);

    handle.restore();
    handle = installApi([
      ...found(),
      { match: friendship, rows: [] },
      { match: request, rows: [], once: true },
      { match: request, rows: [{ "?column?": 1 }] },
    ]);
    await expect(POST(jsonCall("http://localhost/api/friends", "POST", { userId: 2 }))).rejects.toThrow(
      "You already sent a friend request.",
    );

    handle.restore();
    handle = installApi([...found(), { match: friendship, rows: [] }, { match: request, rows: [] }]);
    const sent = await readBody(await POST(jsonCall("http://localhost/api/people?route=friends", "POST", { userId: 2 })));
    expect(sent).toMatchObject({ friends: [], incoming: [], outgoing: [], following: [] });

    handle.restore();
    handle = installApi([
      ...found(),
      { match: request, rows: [{ "?column?": 1 }] },
      { match: "FROM user_friendship f", rows: [{ id: 2, display_name: "Pal", about_me: " hey ", avatar: " pic " }] },
      { match: "WHERE r.addressee_id = $1", rows: [{ id: 3, display_name: "In" }] },
      { match: "WHERE r.requester_id = $1", rows: [{ id: 4, displayName: "Out", about_me: "  ", avatar: "" }] },
      { match: "FROM user_follow f", rows: [{ id: 5, display_name: "Fan" }] },
    ]);
    const accepted = await readBody(await PATCH(jsonCall("http://localhost/api/friends", "PATCH", { userId: 2, action: " Accept " })));
    expect(accepted.friends).toEqual([
      expect.objectContaining({ id: 2, aboutMe: "hey", avatar: "pic", relation: "friends", following: false }),
    ]);
    expect(accepted.following).toEqual([expect.objectContaining({ id: 5, relation: "none", following: true, followedBy: false })]);

    handle.restore();
    handle = installApi([...found(), { match: request, rows: [] }]);
    await expect(PATCH(jsonCall("http://localhost/api/friends", "PATCH", { userId: 2, action: "accept" }))).rejects.toThrow(
      "That friend request is no longer waiting.",
    );
    expect((await PATCH(jsonCall("http://localhost/api/friends", "PATCH", { userId: 2, action: "decline" }))).status).toBe(200);
    expect((await PATCH(jsonCall("http://localhost/api/friends", "PATCH", { userId: 2, action: "cancel" }))).status).toBe(200);
    await expect(PATCH(jsonCall("http://localhost/api/friends", "PATCH", { userId: 2, action: "nope" }))).rejects.toThrow(
      "Choose accept, decline, or cancel.",
    );
    await expect(PATCH(jsonCall("http://localhost/api/friends", "PATCH", "not-json"))).rejects.toThrow(
      "That member was not found.",
    );

    handle.restore();
    handle = installApi(found());
    expect((await DELETE(authed("http://localhost/api/follows?route=friends&id=2"))).status).toBe(200);
    await expect(DELETE(authed("http://localhost/api/friends?id=1"))).rejects.toThrow("That has to be someone else.");
  });

  it("follows, unfollows, and rejects unknown routes", async () => {
    handle = installApi([
      ...found(),
      { match: friendship, rows: [{ "?column?": 1 }] },
      { match: "visibility = 'public'", rows: [] },
      { match: "FROM user_media_progress", rows: [] },
    ]);
    const followed = await readBody(await POST(jsonCall("http://localhost/api/people?route=FOLLOWS", "POST", { userId: 2 })));
    expect(followed.person).toMatchObject({ id: 2, relation: "friends" });

    handle.restore();
    handle = installApi(found(2, { id: 2, displayName: "Pal", aboutMe: "boo", avatar: "" }));
    const unfollowed = await readBody(await DELETE(authed("http://localhost/api/people/follows?id=2")));
    expect(unfollowed.person).toMatchObject({ displayName: "Pal", aboutMe: "boo" });

    handle.restore();
    handle = installApi([
      sessionStep(),
      { match: otherUser, rows: [{ "?column?": 1 }] },
      { match: profile, rows: [] },
    ]);
    await expect(POST(jsonCall("http://localhost/api/follows", "POST", { userId: 2 }))).rejects.toThrow("That member was not found.");

    handle.restore();
    handle = installApi([sessionStep()]);
    expect((await POST(jsonCall("http://localhost/api/people", "POST", {}))).status).toBe(400);
    expect((await PATCH(jsonCall("http://localhost/api/people", "PATCH", {}))).status).toBe(400);
    expect((await DELETE(authed("http://localhost/api/people"))).status).toBe(400);
    expect((await GET(authed("http://localhost/api/friends/"))).status).toBe(200);
    expect((await GET(authed("http://localhost/api/people?route=friends"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "user_friend_request_pair_idx", error: "expression indexes are unsupported" }]);
    expect((await GET(authed("http://localhost/api/follows?route=friends"))).status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(), { match: "display_name ILIKE", error: "db down" }]);
    const failed = await GET(authed("http://localhost/api/people?q=pal"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Could not load people." });

    handle.restore();
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    expect((await GET(authed("http://localhost/api/people?q=pal"))).status).toBe(503);
  });
});
