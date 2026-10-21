import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShowGuide, setEpisodeProgress, setSeasonProgress, setShowProgress } from "./shows";

const guide = { id: "show:4", showId: 4, seasons: [] };

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

describe("show guide", () => {
  it("loads a show and an optional season", async () => {
    const fetchMock = vi.fn(async () => json(guide));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchShowGuide(4)).resolves.toEqual(guide);
    await expect(fetchShowGuide(4, 0)).resolves.toEqual(guide);
    await expect(fetchShowGuide(4, 2)).resolves.toEqual(guide);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/shows?id=show%3A4");
    expect(String(fetchMock.mock.calls[1][0])).toContain("season=0");
    expect(String(fetchMock.mock.calls[2][0])).toContain("season=2");
  });

  it("patches episode, season, and show progress", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return json(guide);
      }),
    );

    await setEpisodeProgress(8, true);
    await setEpisodeProgress(8, false, { dated: false });
    await setEpisodeProgress(8, true, { dated: true, year: 0 });
    await setEpisodeProgress(8, true, { year: 1996 });
    await setSeasonProgress(3, true);
    await setShowProgress(4, true);
    await setShowProgress(4, false, { dated: false });
    await setShowProgress(4, true, { dated: true, year: 2019 });
    await setShowProgress(4, true, { year: 2020 });

    expect(bodies).toEqual([
      { episodeId: 8, completed: true, dated: true },
      { episodeId: 8, completed: false, dated: false },
      { episodeId: 8, completed: true, dated: true, year: 0 },
      { episodeId: 8, completed: true, dated: true, year: 1996 },
      { seasonId: 3, completed: true },
      { id: "show:4", completed: true, dated: true },
      { id: "show:4", completed: false, dated: false },
      { id: "show:4", completed: true, dated: true, year: 2019 },
      { id: "show:4", completed: true, dated: true, year: 2020 },
    ]);
  });

  it("raises server errors, a bad body, and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Missing show" }, 404)));
    await expect(fetchShowGuide(1)).rejects.toThrow("Missing show");

    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(setSeasonProgress(1, false)).rejects.toThrow("Show request failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(fetchShowGuide(1)).resolves.toEqual({});

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(setShowProgress(1, true)).rejects.toThrow("Show request failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchShowGuide(1)).rejects.toThrow("offline");
    await expect(setEpisodeProgress(1, true)).rejects.toThrow("offline");
  });
});
