import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSynopsis, importTmdb, searchTmdb } from "./tmdb";

function respond(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tmdb client", () => {
  it("returns no hits when the payload is not a list and drops values that are not titles", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({})));
    await expect(searchTmdb("movie", "x")).resolves.toEqual([]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond({
          results: [null, "nope", { Title: "Alias", tmdbId: 4 }, { tmdbId: 5 }],
        }),
      ),
    );
    await expect(searchTmdb("movie", "x")).resolves.toEqual([{ tmdbId: 4, title: "Alias" }]);
  });

  it("uses the status when search or import fails without a message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond("nope", 500)));
    await expect(searchTmdb("movie", "x")).rejects.toThrow("TMDb search failed (500)");
    await expect(importTmdb("movie", 8)).rejects.toThrow("TMDb import failed (500)");
  });

  it("rejects an import that does not return a catalog id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({})));
    await expect(importTmdb("book", "OL1W")).rejects.toThrow("TMDb import did not return a catalog title.");
    vi.stubGlobal("fetch", vi.fn(async () => respond({ id: null })));
    await expect(importTmdb("movie", 8)).rejects.toThrow("TMDb import did not return a catalog title.");
    vi.stubGlobal("fetch", vi.fn(async () => respond({ id: "movie:8" })));
    await expect(importTmdb("movie", 8)).resolves.toBe("movie:8");
    vi.stubGlobal("fetch", vi.fn(async () => respond({ error: "TMDb is down" }, 503)));
    await expect(searchTmdb("movie", "x")).rejects.toThrow("TMDb is down");
    await expect(importTmdb("movie", "OL1W")).rejects.toThrow("TMDb is down");
  });

  it("reads a synopsis and reports a failed lookup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({ description: "  A quiet street. " })));
    await expect(fetchSynopsis("movie:4")).resolves.toBe("A quiet street.");
    vi.stubGlobal("fetch", vi.fn(async () => respond({ description: "  " })));
    await expect(fetchSynopsis("movie:4")).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => respond("nope")));
    await expect(fetchSynopsis("movie:4")).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => respond("nope", 500)));
    await expect(fetchSynopsis("movie:4")).rejects.toThrow("Could not load that synopsis.");
    vi.stubGlobal("fetch", vi.fn(async () => respond({ error: "TMDb is down" }, 503)));
    await expect(fetchSynopsis("movie:4")).rejects.toThrow("TMDb is down");
  });
});
