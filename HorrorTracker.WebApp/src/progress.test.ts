import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProgress, fetchProgressIds, readRecentPosters, readScores, readWatchNext, readWatchedYears, setProgress, setScore } from "./progress";

describe("readWatchedYears", () => {
  it("keeps integer years keyed by catalog id", () => {
    expect(readWatchedYears({ watchedYears: { "show:1": 2020, "movie:2": 1996.5 } })).toEqual({
      "show:1": 2020,
    });
    expect(readWatchedYears({})).toEqual({});
  });
});

describe("readWatchNext", () => {
  it("keeps titled catalog picks and drops junk", () => {
    expect(
      readWatchNext({
        watchNext: [
          { id: "show:1", title: "Ratched", kind: "show", reason: "episode", detail: "S1 E2 · The Angel of Mercy", posterPath: "/abc.jpg" },
          { id: "movie:2", title: "", kind: "movie", reason: "vault" },
          { id: "movie:3", title: "Hereditary", kind: "game", reason: "vault" },
        ],
      }),
    ).toEqual([
      {
        id: "show:1",
        title: "Ratched",
        kind: "show",
        reason: "episode",
        detail: "S1 E2 · The Angel of Mercy",
        posterPath: "/abc.jpg",
      },
    ]);
    expect(readWatchNext({})).toEqual([]);
  });
});

describe("readScores", () => {
  it("keeps scores from 1 to 5", () => {
    expect(readScores({ scores: { "movie:1": 4, "show:2": 0, "book:3": 6, "movie:4": 2.5 } })).toEqual({
      "movie:1": 4,
    });
    expect(readScores({})).toEqual({});
  });
});

describe("readRecentPosters", () => {
  it("keeps TMDb paths keyed by catalog id", () => {    expect(
      readRecentPosters({
        recentPosters: { "movie:12": "/abc123.jpg", "show:1": "https://evil.example/x.jpg" },
      }),
    ).toEqual({ "movie:12": "/abc123.jpg" });
    expect(readRecentPosters({})).toEqual({});
  });

  it("ignores posters that are not an object map", () => {
    expect(readRecentPosters(null)).toEqual({});
    expect(readRecentPosters("nope")).toEqual({});
    expect(readRecentPosters({ recentPosters: null })).toEqual({});
    expect(readRecentPosters({ recentPosters: [" /a.jpg"] })).toEqual({});
    expect(readRecentPosters({ recentPosters: { "movie:1": "/ok.jpg", "movie:2": "/a/../b.jpg" } })).toEqual({
      "movie:1": "/ok.jpg",
    });
  });
});

describe("read maps", () => {
  it("rejects years and scores that are not a bounded integer map", () => {
    expect(readWatchedYears(null)).toEqual({});
    expect(readWatchedYears("nope")).toEqual({});
    expect(readWatchedYears({ watchedYears: null })).toEqual({});
    expect(readWatchedYears({ watchedYears: [] })).toEqual({});
    expect(readWatchedYears({ watchedYears: { "movie:1": "1996" } })).toEqual({});

    expect(readScores(null)).toEqual({});
    expect(readScores("nope")).toEqual({});
    expect(readScores({ scores: null })).toEqual({});
    expect(readScores({ scores: [] })).toEqual({});
    expect(readScores({ scores: { "movie:1": 1, "movie:2": 5, "movie:3": "4" } })).toEqual({ "movie:1": 1, "movie:2": 5 });
  });

  it("keeps every watch-next kind and reason and can read the book shelf", () => {
    const kinds = ["movie", "documentary", "show", "book"] as const;
    const reasons = ["episode", "series", "list", "vault"] as const;
    const watchNext = [
      ...kinds.map((kind) => ({ id: `${kind}:1`, title: ` ${kind} `, kind, reason: "vault", detail: "  " })),
      ...reasons.map((reason) => ({ id: `movie:${reason}`, title: reason, kind: "movie", reason, posterPath: "nope" })),
      { id: "", title: "Blank", kind: "movie", reason: "vault" },
      { id: "movie:9", title: "   ", kind: "movie", reason: "vault" },
      { id: 4, title: "Num", kind: "movie", reason: "vault" },
      { id: "movie:8", title: 4, kind: "movie", reason: "vault" },
      { id: "movie:7", title: "Bad reason", kind: "movie", reason: "friend" },
      null,
      "bad",
    ];
    expect(readWatchNext({ watchNext }).map((item) => item.kind)).toEqual([...kinds, ...reasons.map(() => "movie")]);
    expect(readWatchNext({ watchNext: "nope" })).toEqual([]);
    expect(readWatchNext(null)).toEqual([]);
    expect(
      readWatchNext(
        {
          readNext: [{ id: "book:1", title: " It ", kind: "book", reason: "list", detail: " Chapter ", posterPath: "/it.jpg" }],
        },
        "readNext",
      ),
    ).toEqual([{ id: "book:1", title: "It", kind: "book", reason: "list", detail: "Chapter", posterPath: "/it.jpg" }]);
  });
});

const saved = {
  ids: ["movie:1"],
  recentIds: ["movie:1"],
  undatedIds: ["show:1"],
  watchedYears: { "movie:1": 1996 },
  scores: { "movie:1": 5, "movie:2": 1 },
  recentPosters: { "movie:1": "/a.jpg" },
  watchNext: [{ id: "movie:1", title: "Scream", kind: "movie", reason: "vault" }],
  readNext: [],
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

describe("progress requests", () => {
  it("reads a full shelf and an empty one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          ids: ["movie:1", 2],
          recentIds: ["movie:1"],
          undatedIds: [3, "show:1"],
          watchedYears: { "movie:1": 1996, bad: 1.5 },
          scores: { "movie:1": 5, "movie:2": 1, bad: 9 },
          recentPosters: { "movie:1": "/a.jpg", "movie:2": "nope" },
          watchNext: [{ id: "movie:1", title: "Scream", kind: "movie", reason: "vault" }, { id: "", title: "Nope", kind: "movie", reason: "vault" }],
          readNext: "nope",
        }),
      ),
    );
    await expect(fetchProgress()).resolves.toEqual(saved);
    await expect(fetchProgressIds()).resolves.toEqual(["movie:1"]);

    vi.stubGlobal("fetch", vi.fn(async () => json(null)));
    await expect(fetchProgress()).resolves.toEqual({
      ids: [],
      recentIds: [],
      undatedIds: [],
      watchedYears: {},
      scores: {},
      recentPosters: {},
      watchNext: [],
      readNext: [],
    });

    vi.stubGlobal("fetch", vi.fn(async () => json({ ids: "nope", recentIds: 1, undatedIds: {} })));
    await expect(fetchProgress()).resolves.toMatchObject({ ids: [], recentIds: [], undatedIds: [] });

    vi.stubGlobal("fetch", vi.fn(async () => json({}, 401)));
    await expect(fetchProgress()).resolves.toEqual({
      ids: [],
      recentIds: [],
      undatedIds: [],
      watchedYears: {},
      scores: {},
      recentPosters: {},
      watchNext: [],
      readNext: [],
    });
  });

  it("patches completion and score", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return json({ ids: ["movie:1"] });
      }),
    );
    await setProgress("movie:1", true);
    await setProgress("movie:1", false, { dated: false });
    await setProgress("movie:1", true, { dated: true, year: 0 });
    await setProgress("movie:1", true, { year: 1996 });
    await setScore("movie:1", 4);
    await setScore("movie:1", null);
    expect(bodies).toEqual([
      { id: "movie:1", completed: true, dated: true },
      { id: "movie:1", completed: false, dated: false },
      { id: "movie:1", completed: true, dated: true, year: 0 },
      { id: "movie:1", completed: true, dated: true, year: 1996 },
      { id: "movie:1", score: 4 },
      { id: "movie:1", score: null },
    ]);
  });

  it("raises server errors, a bad body, and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Locked" }, 409)));
    await expect(fetchProgress()).rejects.toThrow("Locked");
    await expect(setProgress("movie:1", true)).rejects.toThrow("Locked");
    await expect(setScore("movie:1", 1)).rejects.toThrow("Locked");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(setProgress("movie:1", true)).rejects.toThrow("Progress request failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(setScore("movie:1", 2)).rejects.toThrow("Progress request failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchProgress()).rejects.toThrow("offline");
    await expect(fetchProgressIds()).rejects.toThrow("offline");
    await expect(setScore("movie:1", null)).rejects.toThrow("offline");
  });
});
