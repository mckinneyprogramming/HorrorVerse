import { normalizeVisibility, type UserList } from "./lists";

export interface PersonCard {
  id: number;
  displayName: string;
  aboutMe?: string;
  avatar?: string;
  friendCount: number;
  followerCount: number;
  followingCount: number;
  relation: "self" | "none" | "outgoing" | "incoming" | "friends";
  following: boolean;
  followedBy: boolean;
  lists?: UserList[];
  finishedIds?: string[];
}

export interface FriendInbox {
  friends: PersonCard[];
  incoming: PersonCard[];
  outgoing: PersonCard[];
  following: PersonCard[];
}

export async function searchPeople(query: string): Promise<PersonCard[]> {
  const response = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
  const payload = (await response.json().catch(() => ({}))) as { people?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `People search failed (${response.status})`);
  }

  return readPeople(payload.people);
}

export async function fetchPerson(id: number): Promise<PersonCard> {
  const response = await fetch(`/api/people?id=${encodeURIComponent(String(id))}`);
  const payload = (await response.json().catch(() => ({}))) as { person?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Profile failed (${response.status})`);
  }

  const person = readPerson(payload.person);
  if (!person) {
    throw new Error("That member was not found.");
  }

  return person;
}

export async function fetchFriends(): Promise<FriendInbox> {
  const response = await fetch("/api/friends");
  const payload = (await response.json().catch(() => ({}))) as FriendInbox & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Friends failed (${response.status})`);
  }

  return {
    friends: readPeople(payload.friends),
    incoming: readPeople(payload.incoming),
    outgoing: readPeople(payload.outgoing),
    following: readPeople(payload.following),
  };
}

export async function sendFriendRequest(userId: number): Promise<FriendInbox> {
  return writeFriends("POST", { userId });
}

export async function respondFriend(userId: number, action: "accept" | "decline" | "cancel"): Promise<FriendInbox> {
  return writeFriends("PATCH", { userId, action });
}

export async function unfriend(userId: number): Promise<FriendInbox> {
  const response = await fetch(`/api/friends?id=${encodeURIComponent(String(userId))}`, { method: "DELETE" });
  return readInbox(response);
}

export async function followPerson(userId: number): Promise<PersonCard> {
  const response = await fetch("/api/follows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return readPersonResponse(response);
}

export async function unfollowPerson(userId: number): Promise<PersonCard> {
  const response = await fetch(`/api/follows?id=${encodeURIComponent(String(userId))}`, { method: "DELETE" });
  return readPersonResponse(response);
}

async function writeFriends(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<FriendInbox> {
  const response = await fetch("/api/friends", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readInbox(response);
}

async function readInbox(response: Response): Promise<FriendInbox> {
  const payload = (await response.json().catch(() => ({}))) as FriendInbox & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Friends failed (${response.status})`);
  }

  return {
    friends: readPeople(payload.friends),
    incoming: readPeople(payload.incoming),
    outgoing: readPeople(payload.outgoing),
    following: readPeople(payload.following),
  };
}

async function readPersonResponse(response: Response): Promise<PersonCard> {
  const payload = (await response.json().catch(() => ({}))) as { person?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Follow failed (${response.status})`);
  }

  const person = readPerson(payload.person);
  if (!person) {
    throw new Error("That member was not found.");
  }

  return person;
}

function readPeople(value: unknown): PersonCard[] {
  return Array.isArray(value) ? value.map(readPerson).filter((item): item is PersonCard => item !== null) : [];
}

function readPerson(value: unknown): PersonCard | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = Number(record.id ?? record.Id);
  const displayName = String(record.displayName ?? record.DisplayName ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || !displayName) {
    return null;
  }

  const rawRelation = String(record.relation ?? record.Relation ?? "none").toLowerCase();
  const relation =
    rawRelation === "self" || rawRelation === "friends" || rawRelation === "outgoing" || rawRelation === "incoming"
      ? rawRelation
      : "none";
  const aboutMe = String(record.aboutMe ?? record.AboutMe ?? "").trim();
  const avatar = String(record.avatar ?? record.Avatar ?? "").trim();
  const lists = Array.isArray(record.lists ?? record.Lists) ? (record.lists ?? record.Lists) : undefined;
  const finished = record.finishedIds ?? record.FinishedIds;
  return {
    id,
    displayName,
    relation,
    following: Boolean(record.following ?? record.Following),
    followedBy: Boolean(record.followedBy ?? record.FollowedBy),
    friendCount: Number(record.friendCount ?? record.FriendCount ?? 0) || 0,
    followerCount: Number(record.followerCount ?? record.FollowerCount ?? 0) || 0,
    followingCount: Number(record.followingCount ?? record.FollowingCount ?? 0) || 0,
    ...(aboutMe ? { aboutMe } : {}),
    ...(avatar ? { avatar } : {}),
    ...(Array.isArray(lists)
      ? {
          lists: lists
            .map((item) => {
              if (!item || typeof item !== "object") {
                return null;
              }

              const list = item as Record<string, unknown>;
              const listId = Number(list.id ?? list.Id);
              const name = String(list.name ?? list.Name ?? "").trim();
              const items = Array.isArray(list.items ?? list.Items) ? ((list.items ?? list.Items) as unknown[]) : [];
              if (!Number.isInteger(listId) || listId < 1 || !name) {
                return null;
              }

              return {
                id: listId,
                name,
                items: items.filter((entry): entry is string => typeof entry === "string"),
                visibility: normalizeVisibility(list.visibility ?? list.Visibility),
              } satisfies UserList;
            })
            .filter((item): item is UserList => item !== null),
        }
      : {}),
    ...(Array.isArray(finished) ? { finishedIds: finished.filter((item): item is string => typeof item === "string") } : {}),
  };
}
