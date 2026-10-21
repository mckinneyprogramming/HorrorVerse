import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, testConn, textResponse, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import { ensureGameColumns, igdbCoverUrl, importIgdbGame, normalizeIgdbCoverUrl, parseIgdbGame, parseIgdbId, parseIgdbSearch, searchIgdb } from "./igdb";

describe("parseIgdbId", () => {
  it("keeps positive numeric IGDB ids", () => {
    expect(parseIgdbId("1942")).toBe("1942");
    expect(parseIgdbId("0")).toBeUndefined();
    expect(parseIgdbId("OL1W")).toBeUndefined();
  });
});

describe("igdbCoverUrl", () => {
  it("builds the Cloudinary-style IGDB cover path and rewrites legacy URLs", () => {
    expect(igdbCoverUrl("co1r74")).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg");
    expect(normalizeIgdbCoverUrl("https://images.igdb.com/igdb/image/t_cover_big/co1r74.jpg")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg",
    );
  });
});

describe("parseIgdbSearch", () => {
  it("maps title, year, genres, platforms, and cover, with horror first", () => {
    expect(
      parseIgdbSearch([
        {
          id: 1,
          name: "Cooking Mama",
          first_release_date: 1136073600,
          genres: [{ name: "Simulator" }],
          cover: { image_id: "abc" },
        },
        {
          id: 1942,
          name: "Resident Evil",
          first_release_date: 828316800,
          genres: [{ name: "Adventure" }],
          themes: [{ name: "Horror" }],
          platforms: [{ name: "PlayStation" }],
          cover: { image_id: "co1r74" },
        },
      ]),
    ).toEqual([
      {
        sourceId: "1942",
        title: "Resident Evil",
        year: 1996,
        overview: "Adventure · PlayStation",
        coverUrl: igdbCoverUrl("co1r74"),
      },
      {
        sourceId: "1",
        title: "Cooking Mama",
        year: 2006,
        overview: "Simulator",
        coverUrl: igdbCoverUrl("abc"),
      },
    ]);
  });
});

describe("parseIgdbGame", () => {
  it("keeps summary, companies, platforms, and genres", () => {
    const game = parseIgdbGame([
      {
        id: 1942,
        name: "Resident Evil",
        summary: "A mansion hides something worse.",
        first_release_date: 828316800,
        cover: { image_id: "co1r74" },
        genres: [{ name: "Adventure" }],
        themes: [{ name: "Horror" }],
        platforms: [{ name: "PlayStation" }, { name: "PC" }],
        involved_companies: [
          { developer: true, company: { name: "Capcom" } },
          { publisher: true, company: { name: "Capcom" } },
        ],
      },
    ]);

    expect(game).toMatchObject({
      sourceId: "1942",
      title: "Resident Evil",
      year: 1996,
      description: "A mansion hides something worse.",
      developer: "Capcom",
      publisher: "Capcom",
      platforms: "PlayStation, PC",
      coverUrl: igdbCoverUrl("co1r74"),
    });
    expect(game?.genres).toEqual(["Adventure", "Horror"]);
  });
});

describe("igdb parsing edges", () => {
  it("rejects ids and covers that are not usable", () => {
    expect(parseIgdbId(null)).toBeUndefined();
    expect(parseIgdbId(" 12 ")).toBe("12");
    expect(parseIgdbId("-1")).toBeUndefined();
    expect(parseIgdbId("01")).toBe("01");
    expect(igdbCoverUrl(null)).toBeUndefined();
    expect(igdbCoverUrl("")).toBeUndefined();
    expect(igdbCoverUrl("bad/id")).toBeUndefined();
    expect(igdbCoverUrl("a".repeat(81))).toBeUndefined();

    const current = "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg";
    expect(normalizeIgdbCoverUrl(`  ${current}  `)).toBe(current);
    expect(normalizeIgdbCoverUrl("http://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg")).toBeUndefined();
    expect(normalizeIgdbCoverUrl(`https://images.igdb.com/igdb/image/t_cover_big/${"a".repeat(81)}.jpg`)).toBeUndefined();
    expect(normalizeIgdbCoverUrl(null)).toBeUndefined();
    expect(normalizeIgdbCoverUrl(undefined)).toBeUndefined();
    expect(normalizeIgdbCoverUrl("")).toBeUndefined();
  });

  it("drops bad search rows, keeps bare hits, and caps at eight", () => {
    expect(parseIgdbSearch("nope")).toEqual([]);
    expect(parseIgdbSearch([null, { name: "No id" }, { id: 4, name: "  " }, { id: 9, name: "Bare" }])).toEqual([
      { sourceId: "9", title: "Bare" },
    ]);

    const tied = parseIgdbSearch([
      { id: 1, name: "A", genres: [{ name: "Puzzle" }, { name: "  " }, { name: "Adventure" }, { name: "Extra" }] },
      { id: 2, name: "B", genres: [{ name: "Horror" }], platforms: [{ name: "PC" }, { name: "PS" }, { name: "X" }, { name: "N64" }] },
      { id: 3, name: "C", themes: [{ name: "Horror" }], cover: { image_id: "bad/id" } },
    ]);
    expect(tied.map((hit) => hit.sourceId)).toEqual(["2", "3", "1"]);
    expect(tied[0]?.overview).toBe("Horror · PC, PS, X");
    expect(tied[1]?.coverUrl).toBeUndefined();
    expect(tied[2]?.overview).toBe("Puzzle, Adventure");

    const hits = parseIgdbSearch(Array.from({ length: 9 }, (_, index) => ({
      id: index + 1,
      name: `Game ${index}`,
      themes: [{ name: "Horror" }],
    })));
    expect(hits).toHaveLength(8);
    expect(hits.some((hit) => hit.sourceId === "9")).toBe(false);
  });

  it("reads a single object and leaves optional game fields off", () => {
    expect(parseIgdbGame([])).toBeUndefined();
    expect(parseIgdbGame([{ id: 1 }])).toBeUndefined();
    expect(parseIgdbGame([{ name: "No id" }])).toBeUndefined();
    expect(parseIgdbGame({ id: 3, name: "  Solo   Game  " })).toMatchObject({
      sourceId: "3",
      title: "Solo Game",
      year: 0,
      genres: [],
    });

    const future = Date.UTC(3001, 0, 1) / 1000;
    const sparse = parseIgdbGame([{
      id: 8,
      name: "t".repeat(250),
      summary: "s".repeat(4001),
      first_release_date: future,
      genres: "no",
      involved_companies: "no",
    }]);
    expect(sparse?.title).toHaveLength(200);
    expect(sparse?.description).toHaveLength(4000);
    expect(sparse?.year).toBe(0);
    expect(sparse?.developer).toBeUndefined();
    expect(sparse?.publisher).toBeUndefined();
    expect(sparse?.platforms).toBeUndefined();
    expect(sparse?.coverUrl).toBeUndefined();

    const crowded = parseIgdbGame([{
      id: 9,
      name: "Crowded",
      first_release_date: 0,
      genres: [{ name: "Horror" }, { name: "horror" }, { name: "ewkoyjfa" }, ...Array.from({ length: 12 }, (_, index) => ({ name: `Genre ${index}` }))],
      themes: [{ name: "Horror" }],
      platforms: Array.from({ length: 9 }, (_, index) => ({ name: `Platform ${index}` })),
      involved_companies: [
        "skip",
        { company: { name: "  " } },
        { developer: false, publisher: false, company: { name: "Unused" } },
        { developer: true, publisher: true, company: { name: "Capcom" } },
        { developer: true, company: { name: "A".repeat(120) } },
        { developer: true, company: { name: "B".repeat(120) } },
        { publisher: true, company: { name: "Pubs" } },
      ],
    }]);
    expect(crowded?.genres).toHaveLength(12);
    expect(crowded?.genres[0]).toBe("Horror");
    expect(crowded?.developer?.length).toBe(180);
    expect(crowded?.publisher).toContain("Capcom");
    expect(crowded?.platforms?.startsWith("Platform 0")).toBe(true);
    expect(crowded?.platforms?.includes("Platform 8")).toBe(false);
    expect(crowded?.year).toBe(0);
  });
});

describe("igdb network", () => {
  const connection = testConn("igdb");
  let now = 1_800_000_000_000;

  beforeEach(() => {
    now += 10 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function respond(token: Response, igdb: Response | (() => Response)) {
    return (url: string) => {
      if (url.includes("id.twitch.tv")) {
        return token;
      }

      if (url.includes("api.igdb.com")) {
        return typeof igdb === "function" ? igdb() : igdb;
      }

      throw new Error(url);
    };
  }

  const token = (body: unknown = { access_token: "tok", expires_in: 30 }, status = 200) => jsonResponse(body, status);
  const games = (body: unknown = []) => jsonResponse(body);

  it("requires a client id and secret before it asks Twitch", async () => {
    await expect(withNeonFetch({ IGDB_CLIENT_ID: undefined, IGDB_CLIENT_SECRET: "secret" }, unreachableNetwork, [], async () => {
      await searchIgdb("resident");
    })).rejects.toMatchObject({ status: 503, message: "IGDB_CLIENT_ID is not configured." });

    await expect(withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: undefined }, unreachableNetwork, [], async () => {
      await searchIgdb("resident");
    })).rejects.toMatchObject({ status: 503, message: "IGDB_CLIENT_SECRET is not configured." });
  });

  it("fails when Twitch or IGDB does not return usable JSON", async () => {
    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token({ message: "no" }, 500), games()), [], async () => {
      await expect(searchIgdb("resident")).rejects.toMatchObject({ status: 502, message: "Could not authenticate with IGDB." });
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token({ expires_in: 30 }), games()), [], async () => {
      await expect(searchIgdb("resident")).rejects.toMatchObject({ status: 502, message: "Could not authenticate with IGDB." });
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(textResponse("nope", 200), games()), [], async () => {
      await expect(searchIgdb("resident")).rejects.toMatchObject({ status: 502, message: "Could not authenticate with IGDB." });
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), jsonResponse({}, 500)), [], async () => {
      await expect(searchIgdb("resident")).rejects.toMatchObject({ status: 502, message: "Could not reach IGDB." });
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), textResponse("nope", 200)), [], async () => {
      await expect(searchIgdb("resident")).rejects.toMatchObject({ status: 502, message: "Could not reach IGDB." });
    });
  });

  it("escapes search text and reuses a token until it expires", async () => {
    const bodies: string[] = [];
    let twitch = 0;
    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, (url, init) => {
      if (url.includes("id.twitch.tv")) {
        twitch += 1;
        return token({ access_token: "tok", expires_in: 500 });
      }

      bodies.push(String(init?.body));
      const headers = init?.headers as Record<string, string>;
      expect(headers["Client-ID"]).toBe("client");
      expect(headers.Authorization).toBe("Bearer tok");
      return games([{ id: 1, name: "Resident Evil", themes: [{ name: "Horror" }] }]);
    }, [], async () => {
      await expect(searchIgdb('say "hi" \\\\')).resolves.toMatchObject([{ sourceId: "1", title: "Resident Evil" }]);
      await expect(searchIgdb("again")).resolves.toMatchObject([{ sourceId: "1" }]);
    });

    expect(twitch).toBe(1);
    expect(bodies[0]).toContain(String.raw`search "say \"hi\" \\\\"`);
    now += 700_000;
    twitch = 0;
    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, (url) => {
      if (url.includes("id.twitch.tv")) {
        twitch += 1;
        return token({ access_token: "next", expires_in: 30 });
      }

      return games([]);
    }, [], async () => {
      await expect(searchIgdb("later")).resolves.toEqual([]);
    });
    expect(twitch).toBe(1);
  });

  it("defaults the token lifetime when Twitch omits a positive expires_in", async () => {
    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token({ access_token: "tok", expires_in: 0 }), games([])), [], async () => {
      await expect(searchIgdb("zero")).resolves.toEqual([]);
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token({ access_token: "tok" }), games([])), [], async () => {
      await expect(searchIgdb("missing")).resolves.toEqual([]);
    });
  });

  it("adds a new game, refreshes an existing one, and reports save failures", async () => {
    const full = [{
      id: 1942,
      name: "Resident Evil",
      summary: "A mansion.",
      first_release_date: 828316800,
      cover: { image_id: "co1r74" },
      genres: [{ name: "Horror" }, { name: "horror" }, { name: "ewkoyjfa" }],
      themes: [{ name: "Survival horror" }],
      platforms: [{ name: "PlayStation" }],
      involved_companies: [{ developer: true, publisher: true, company: { name: "Capcom" } }],
    }];

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), games(full)), [
      { match: "INSERT INTO game", rows: [{ id: 9 }] },
    ], async (neon) => {
      await expect(importIgdbGame(connection, "1942")).resolves.toEqual({ added: 1, id: "game:9" });
      expect(neon.calls.some((call) => call.params.includes("ewkoyjfa"))).toBe(true);
      expect(neon.calls.find((call) => call.query.includes("UPDATE game"))?.params).toContain("Capcom");
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), games([{ id: 5, name: "Pong" }])), [
      { match: "INSERT INTO game", rows: [{ id: 11 }] },
    ], async (neon) => {
      await expect(importIgdbGame(connection, "5")).resolves.toEqual({ added: 1, id: "game:11" });
      const update = neon.calls.find((call) => call.query.startsWith("UPDATE game"));
      expect(update?.params.slice(4)).toEqual([null, null, null, null, null]);
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), games(full)), [
      { match: "WHERE igdbid", rows: [{ id: 4 }] },
    ], async (neon) => {
      await expect(importIgdbGame(connection, "1942")).resolves.toEqual({ added: 0, id: "game:4" });
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO game ("))).toBe(false);
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), games([{ id: 6, name: "Lost" }])), [], async () => {
      await expect(importIgdbGame(connection, "6")).rejects.toMatchObject({ status: 500, message: "Could not save that game." });
    });
  });

  it("rejects a bad id, an empty IGDB payload, and an IGDB error", async () => {
    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, unreachableNetwork, [], async (neon) => {
      await expect(importIgdbGame(connection, "nope")).rejects.toMatchObject({ status: 400, message: "Choose an IGDB game to add." });
      expect(neon.calls).toEqual([]);
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), games([])), [], async () => {
      await expect(importIgdbGame(connection, "4")).rejects.toMatchObject({ status: 502, message: "IGDB did not return that game." });
    });

    await withNeonFetch({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }, respond(token(), jsonResponse({}, 502)), [], async () => {
      await expect(importIgdbGame(connection, "4")).rejects.toMatchObject({ status: 502, message: "Could not reach IGDB." });
    });
  });

  it("creates the game columns", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await ensureGameColumns(connection);
      expect(neon.calls.length).toBeGreaterThanOrEqual(7);
    });
  });
});
