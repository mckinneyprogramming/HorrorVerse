import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addFranchiseItem,
  createFranchise,
  deleteFranchise,
  fetchFranchises,
  FRANCHISE_KIND_OPTIONS,
  isFranchiseKind,
  removeFranchiseItem,
  renameFranchise,
} from "./franchises";

const parsed = [
  { id: 1, name: "Alien", items: ["movie:1"] },
  { id: 2, name: "Saw", items: ["movie:2"] },
  { id: 7, name: "NullItems", items: ["a"] },
];

const rich = {
  franchises: [
    { id: 1, name: " Alien ", items: ["movie:1", 2] },
    { Id: 2, Name: " Saw ", Items: ["movie:2"] },
    { id: 7, name: "NullItems", items: null, Items: ["a", 3] },
    null,
    { id: 0, name: "Zero", items: [] },
    { id: 1.5, name: "Frac", items: [] },
    { id: 3, name: "   ", items: [] },
    { id: 4, name: "NoItems" },
    { id: 5, Name: "FromName", items: "nope" },
    { id: 6, items: [] },
    { name: "NoId", items: [] },
    "bad",
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

describe("isFranchiseKind", () => {
  it("accepts the four vault kinds", () => {
    expect(FRANCHISE_KIND_OPTIONS.map((option) => option.id)).toEqual(["series", "movie", "show", "book"]);
    expect(isFranchiseKind("movie")).toBe(true);
    expect(isFranchiseKind("book")).toBe(true);
    expect(isFranchiseKind("game")).toBe(false);
    expect(isFranchiseKind("")).toBe(false);
  });
});

describe("franchise requests", () => {
  it("parses a mixed payload and runs every mutation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return json(rich);
      }

      return json({ franchises: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchFranchises()).resolves.toEqual(parsed);
    await expect(createFranchise("Alien")).resolves.toEqual([]);
    await expect(renameFranchise(2, "Saw")).resolves.toEqual([]);
    await expect(deleteFranchise(2)).resolves.toEqual([]);
    await expect(addFranchiseItem(2, "movie:2")).resolves.toEqual([]);
    await expect(removeFranchiseItem(2, "movie:2")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith("/api/franchises");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/franchises",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Alien" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/franchises",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: 2, name: "Saw" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/franchises?id=2", { method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/franchises?franchiseId=2&itemId=movie%3A2",
      { method: "DELETE" },
    );
  });

  it("returns nothing for an empty or malformed body", async () => {
    for (const body of [{}, { franchises: null }, { franchises: "no" }, null]) {
      vi.stubGlobal("fetch", vi.fn(async () => json(body)));
      await expect(fetchFranchises()).resolves.toEqual([]);
    }
  });

  it("raises server errors, a bad body, and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Taken" }, 409)));
    await expect(fetchFranchises()).rejects.toThrow("Taken");
    await expect(createFranchise("A")).rejects.toThrow("Taken");
    await expect(renameFranchise(1, "A")).rejects.toThrow("Taken");
    await expect(deleteFranchise(1)).rejects.toThrow("Taken");
    await expect(addFranchiseItem(1, "movie:1")).rejects.toThrow("Taken");
    await expect(removeFranchiseItem(1, "movie:1")).rejects.toThrow("Taken");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(deleteFranchise(1)).rejects.toThrow("Franchises request failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(createFranchise("A")).rejects.toThrow("Franchises request failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchFranchises()).rejects.toThrow("offline");
    await expect(removeFranchiseItem(1, "a")).rejects.toThrow("offline");
  });
});
