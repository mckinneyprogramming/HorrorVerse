import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addFranchiseToList,
  addListItem,
  createList,
  deleteList,
  fetchLists,
  normalizeVisibility,
  removeFranchiseFromList,
  removeListItem,
  renameList,
  setListVisibility,
} from "./lists";

describe("normalizeVisibility", () => {
  it("keeps public lists public", () => {
    expect(normalizeVisibility("public")).toBe("public");
    expect(normalizeVisibility("PUBLIC")).toBe("public");
  });

  it("treats anything else as private", () => {
    expect(normalizeVisibility("private")).toBe("private");
    expect(normalizeVisibility("Publicish")).toBe("private");
    expect(normalizeVisibility("")).toBe("private");
    expect(normalizeVisibility(undefined)).toBe("private");
    expect(normalizeVisibility(null)).toBe("private");
  });
});

const parsed = [
  { id: 1, name: "October", items: ["movie:1"], visibility: "public" as const },
  { id: 2, name: "Night", items: [], visibility: "public" as const },
  { id: 3, name: "Plain", items: ["a"], visibility: "private" as const },
];

const rich = {
  lists: [
    { id: 1, name: "October", items: ["movie:1", 2], visibility: "public" },
    { id: 2, name: "Night", items: [], Visibility: "Public" },
    { id: 3, name: "Plain", items: ["a"] },
    null,
    { id: "x", name: "Bad", items: [] },
    { name: "NoId", items: [] },
    { id: 4, items: [] },
    { id: 5, name: "NoItems" },
    "z",
  ],
};

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

describe("list requests", () => {
  it("parses mixed rows and runs every mutation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return json(rich);
      }

      return json({ lists: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLists()).resolves.toEqual(parsed);
    await expect(createList("October")).resolves.toEqual([]);
    await expect(renameList(1, "Night")).resolves.toEqual([]);
    await expect(setListVisibility(1, "public")).resolves.toEqual([]);
    await expect(deleteList(1)).resolves.toEqual([]);
    await expect(addListItem(1, "movie:1")).resolves.toEqual([]);
    await expect(addFranchiseToList(1, 9)).resolves.toEqual([]);
    await expect(removeListItem(1, "movie:1")).resolves.toEqual([]);
    await expect(removeFranchiseFromList(1, 9)).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith("/api/lists");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "October" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: 1, name: "Night" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: 1, visibility: "public" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ listId: 1, itemId: "movie:1" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ listId: 1, franchiseId: 9 }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/lists?id=1", { method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledWith("/api/lists?listId=1&itemId=movie%3A1", { method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledWith("/api/lists?listId=1&franchiseId=9", { method: "DELETE" });
  });

  it("returns nothing for an empty payload and an empty list when signed out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(null, 401)));
    await expect(fetchLists()).resolves.toEqual([]);

    for (const body of [{}, { lists: null }, { lists: "no" }, null]) {
      vi.stubGlobal("fetch", vi.fn(async () => json(body)));
      await expect(fetchLists()).resolves.toEqual([]);
    }
  });

  it("raises server errors, a bad body, and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Taken" }, 409)));
    await expect(fetchLists()).rejects.toThrow("Taken");
    await expect(createList("A")).rejects.toThrow("Taken");
    await expect(renameList(1, "A")).rejects.toThrow("Taken");
    await expect(setListVisibility(1, "private")).rejects.toThrow("Taken");
    await expect(deleteList(1)).rejects.toThrow("Taken");
    await expect(addListItem(1, "movie:1")).rejects.toThrow("Taken");
    await expect(addFranchiseToList(1, 2)).rejects.toThrow("Taken");
    await expect(removeListItem(1, "movie:1")).rejects.toThrow("Taken");
    await expect(removeFranchiseFromList(1, 2)).rejects.toThrow("Taken");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(deleteList(1)).rejects.toThrow("Lists request failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(createList("A")).rejects.toThrow("Lists request failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchLists()).rejects.toThrow("offline");
    await expect(removeListItem(1, "a")).rejects.toThrow("offline");
  });
});
