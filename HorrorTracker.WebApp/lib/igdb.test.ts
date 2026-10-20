import { describe, expect, it } from "vitest";
import { igdbCoverUrl, parseIgdbGame, parseIgdbId, parseIgdbSearch } from "./igdb";

describe("parseIgdbId", () => {
  it("keeps positive numeric IGDB ids", () => {
    expect(parseIgdbId("1942")).toBe("1942");
    expect(parseIgdbId("0")).toBeUndefined();
    expect(parseIgdbId("OL1W")).toBeUndefined();
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
