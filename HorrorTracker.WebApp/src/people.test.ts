import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFriends,
  fetchPerson,
  followPerson,
  respondFriend,
  searchPeople,
  sendFriendRequest,
  unfriend,
  unfollowPerson,
} from "./people";

const people = [
  {
    id: 7,
    displayName: " Riley ",
    relation: "friends",
    following: true,
    followedBy: false,
    friendCount: 2,
    followerCount: 3,
    followingCount: 4,
    aboutMe: " Boo ",
    avatar: " pic ",
    lists: [{ id: 1, name: " October ", items: ["movie:1", 2], visibility: "public" }],
    finishedIds: ["movie:1", 4],
  },
  {
    Id: 8,
    DisplayName: "Sam",
    Relation: "SELF",
    Following: true,
    FollowedBy: false,
    FriendCount: 1,
    FollowerCount: "2",
    FollowingCount: 0,
    AboutMe: "Hey",
    Avatar: "ava",
    Lists: [{ Id: 3, Name: "Night", Items: ["show:1"], Visibility: "Public" }],
    FinishedIds: ["show:1"],
  },
  { id: 9, displayName: "Pat", relation: "nope", aboutMe: "  ", avatar: "", followedBy: true, following: false },
  {
    id: 10,
    displayName: "Jo",
    lists: [null, 1, { id: 0, name: "Zero" }, { id: 1.2, name: "Frac" }, { id: 4, name: "  " }, { id: 7 }, { id: 5, name: "Ok", items: "bad" }, { id: 6, name: "Also", Items: [1, "movie:2"] }],
    finishedIds: "no",
    FinishedIds: ["ignored"],
    friendCount: "nope",
    followerCount: null,
  },
  { id: 11, displayName: "Out", relation: "outgoing" },
  { id: 12, displayName: "In", Relation: "INCOMING" },
  {
    id: 15,
    displayName: "Lee",
    lists: null,
    Lists: [{ id: 8, name: "Alt", items: [] }],
    finishedIds: null,
    FinishedIds: ["book:1", 2],
  },
  { id: 16, displayName: "Skip", lists: "bad", Lists: [{ id: 1, name: "Hidden", items: [] }] },
  null,
  "x",
  { id: 0, displayName: "Zero" },
  { id: 1.5, displayName: "Frac" },
  { id: 13, displayName: "   " },
  { displayName: "NoId" },
  { id: 14 },
];

const parsed = [
  {
    id: 7,
    displayName: "Riley",
    relation: "friends",
    following: true,
    followedBy: false,
    friendCount: 2,
    followerCount: 3,
    followingCount: 4,
    aboutMe: "Boo",
    avatar: "pic",
    lists: [{ id: 1, name: "October", items: ["movie:1"], visibility: "public" }],
    finishedIds: ["movie:1"],
  },
  {
    id: 8,
    displayName: "Sam",
    relation: "self",
    following: true,
    followedBy: false,
    friendCount: 1,
    followerCount: 2,
    followingCount: 0,
    aboutMe: "Hey",
    avatar: "ava",
    lists: [{ id: 3, name: "Night", items: ["show:1"], visibility: "public" }],
    finishedIds: ["show:1"],
  },
  {
    id: 9,
    displayName: "Pat",
    relation: "none",
    following: false,
    followedBy: true,
    friendCount: 0,
    followerCount: 0,
    followingCount: 0,
  },
  {
    id: 10,
    displayName: "Jo",
    relation: "none",
    following: false,
    followedBy: false,
    friendCount: 0,
    followerCount: 0,
    followingCount: 0,
    lists: [
      { id: 5, name: "Ok", items: [], visibility: "private" },
      { id: 6, name: "Also", items: ["movie:2"], visibility: "private" },
    ],
  },
  {
    id: 11,
    displayName: "Out",
    relation: "outgoing",
    following: false,
    followedBy: false,
    friendCount: 0,
    followerCount: 0,
    followingCount: 0,
  },
  {
    id: 12,
    displayName: "In",
    relation: "incoming",
    following: false,
    followedBy: false,
    friendCount: 0,
    followerCount: 0,
    followingCount: 0,
  },
  {
    id: 15,
    displayName: "Lee",
    relation: "none",
    following: false,
    followedBy: false,
    friendCount: 0,
    followerCount: 0,
    followingCount: 0,
    lists: [{ id: 8, name: "Alt", items: [], visibility: "private" }],
    finishedIds: ["book:1"],
  },
  {
    id: 16,
    displayName: "Skip",
    relation: "none",
    following: false,
    followedBy: false,
    friendCount: 0,
    followerCount: 0,
    followingCount: 0,
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchPeople", () => {
  it("parses camel and Pascal profiles and drops junk", async () => {
    const fetchMock = vi.fn(async () => json({ people }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchPeople("Ann & Riley")).resolves.toEqual(parsed);
    expect(fetchMock).toHaveBeenCalledWith("/api/people?q=Ann%20%26%20Riley");
  });

  it("returns an empty list for a non-array or unreadable body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ people: "no" })));
    await expect(searchPeople("a")).resolves.toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => json({})));
    await expect(searchPeople("a")).resolves.toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(searchPeople("a")).resolves.toEqual([]);
  });

  it("raises server errors and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Down" }, 503)));
    await expect(searchPeople("a")).rejects.toThrow("Down");
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(searchPeople("a")).rejects.toThrow("People search failed (500)");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(searchPeople("a")).rejects.toThrow("People search failed (502)");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(searchPeople("a")).rejects.toThrow("offline");
  });
});

describe("fetchPerson", () => {
  it("returns one member", async () => {
    const fetchMock = vi.fn(async () => json({ person: people[0] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPerson(7)).resolves.toEqual(parsed[0]);
    expect(fetchMock).toHaveBeenCalledWith("/api/people?id=7");
  });

  it("raises when the member is missing, the server fails, or the network drops", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ person: null })));
    await expect(fetchPerson(4)).rejects.toThrow("That member was not found.");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Hidden" }, 404)));
    await expect(fetchPerson(4)).rejects.toThrow("Hidden");
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(fetchPerson(4)).rejects.toThrow("Profile failed (500)");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(fetchPerson(4)).rejects.toThrow("That member was not found.");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(fetchPerson(4)).rejects.toThrow("Profile failed (502)");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchPerson(4)).rejects.toThrow("offline");
  });
});

describe("friends", () => {
  it("reads each inbox list and ignores junk entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ friends: [people[0], null], incoming: "no", outgoing: null, following: [people[4]] })),
    );
    await expect(fetchFriends()).resolves.toEqual({
      friends: [parsed[0]],
      incoming: [],
      outgoing: [],
      following: [parsed[4]],
    });
  });

  it("sends, answers, and removes friend requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "DELETE") {
        return json({ friends: [], incoming: [], outgoing: [], following: [] });
      }

      return json({ friends: [people[0]], incoming: [], outgoing: [], following: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFriendRequest(8)).resolves.toEqual({ friends: [parsed[0]], incoming: [], outgoing: [], following: [] });
    await expect(respondFriend(8, "accept")).resolves.toMatchObject({ friends: [parsed[0]] });
    await expect(respondFriend(8, "decline")).resolves.toMatchObject({ friends: [parsed[0]] });
    await expect(respondFriend(8, "cancel")).resolves.toMatchObject({ friends: [parsed[0]] });
    await expect(unfriend(8)).resolves.toEqual({ friends: [], incoming: [], outgoing: [], following: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/friends",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: 8 }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/friends",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ userId: 8, action: "accept" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/friends?id=8", { method: "DELETE" });
  });

  it("raises inbox errors and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Denied" }, 403)));
    await expect(fetchFriends()).rejects.toThrow("Denied");
    await expect(sendFriendRequest(1)).rejects.toThrow("Denied");
    await expect(unfriend(1)).rejects.toThrow("Denied");

    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(fetchFriends()).rejects.toThrow("Friends failed (500)");
    await expect(respondFriend(1, "accept")).rejects.toThrow("Friends failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(fetchFriends()).resolves.toEqual({ friends: [], incoming: [], outgoing: [], following: [] });
    await expect(sendFriendRequest(1)).resolves.toEqual({ friends: [], incoming: [], outgoing: [], following: [] });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(unfriend(1)).rejects.toThrow("Friends failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchFriends()).rejects.toThrow("offline");
    await expect(sendFriendRequest(1)).rejects.toThrow("offline");
    await expect(unfriend(1)).rejects.toThrow("offline");
  });
});

describe("follows", () => {
  it("follows and unfollows a member", async () => {
    const fetchMock = vi.fn(async () => json({ person: people[1] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(followPerson(8)).resolves.toEqual(parsed[1]);
    await expect(unfollowPerson(8)).resolves.toEqual(parsed[1]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/follows",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: 8 }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/follows?id=8", { method: "DELETE" });
  });

  it("raises when the follow target is missing, the server fails, or the network drops", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ person: null })));
    await expect(followPerson(1)).rejects.toThrow("That member was not found.");
    await expect(unfollowPerson(1)).rejects.toThrow("That member was not found.");

    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Nope" }, 404)));
    await expect(followPerson(1)).rejects.toThrow("Nope");

    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(unfollowPerson(1)).rejects.toThrow("Follow failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(followPerson(1)).rejects.toThrow("That member was not found.");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(unfollowPerson(1)).rejects.toThrow("Follow failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(followPerson(1)).rejects.toThrow("offline");
    await expect(unfollowPerson(1)).rejects.toThrow("offline");
  });
});
