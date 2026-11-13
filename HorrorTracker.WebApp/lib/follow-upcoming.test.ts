import { describe, expect, it } from "vitest";
import { testConn, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import { loadFollowCredits, matchFollowUpcoming } from "./follow-upcoming";

describe("matchFollowUpcoming", () => {
  it("keeps dated film and show matches for followed credits", () => {
    expect(
      matchFollowUpcoming(
        [
          { personId: 5, personName: "Carpenter", tmdbId: 10, mediaType: "movie", role: "Director", posterPath: "/c.jpg" },
          { personId: 6, personName: "Jamie", tmdbId: 20, mediaType: "tv", role: "Lead" },
          { personId: 7, personName: "Skip", tmdbId: 0, mediaType: "movie", role: "Cast" },
        ],
        {
          films: [
            { kind: "film", tmdbId: 10, title: "New Night", releaseDate: "2099-08-02", posterPath: "/n.jpg" },
            { kind: "film", tmdbId: 11, title: "Other", releaseDate: "2099-08-01" },
          ],
          shows: [{ kind: "episode", tmdbId: 20, title: "The Zone", releaseDate: "2099-08-01", detail: "S2 E1" }],
        },
        2,
      ),
    ).toEqual([
      {
        tmdbId: 20,
        kind: "episode",
        title: "The Zone",
        releaseDate: "2099-08-01",
        detail: "S2 E1",
        personId: 6,
        personName: "Jamie",
        role: "Lead",
      },
      {
        tmdbId: 10,
        kind: "film",
        title: "New Night",
        releaseDate: "2099-08-02",
        posterPath: "/n.jpg",
        personId: 5,
        personName: "Carpenter",
        role: "Director",
      },
    ]);
  });

  it("returns nothing without credits or dated titles", () => {
    expect(matchFollowUpcoming([], { films: [{ kind: "film", tmdbId: 1, title: "A", releaseDate: "2099-01-01" }], shows: [] })).toEqual([]);
    expect(
      matchFollowUpcoming([{ personId: 1, personName: "A", tmdbId: 1, mediaType: "movie", role: "Cast" }], {
        films: [{ kind: "film", tmdbId: 1, title: "A", releaseDate: "soon" }],
        shows: [],
      }),
    ).toEqual([]);
  });

  it("skips a second copy of the same dated title and sorts ties by name", () => {
    expect(
      matchFollowUpcoming(
        [
          { personId: 1, personName: "A", tmdbId: 1, mediaType: "movie", role: "  " },
          { personId: 2, personName: "B", tmdbId: 2, mediaType: "movie", role: "Cast" },
        ],
        {
          films: [
            { kind: "film", tmdbId: 1, title: "B", releaseDate: "2099-01-01" },
            { kind: "film", tmdbId: 1, title: "A", releaseDate: "2099-01-01" },
            { kind: "film", tmdbId: 2, title: "Aardvark", releaseDate: "2099-01-01" },
          ],
          shows: [],
        },
      ),
    ).toEqual([
      {
        tmdbId: 2,
        kind: "film",
        title: "Aardvark",
        releaseDate: "2099-01-01",
        personId: 2,
        personName: "B",
        role: "Cast",
      },
      {
        tmdbId: 1,
        kind: "film",
        title: "B",
        releaseDate: "2099-01-01",
        personId: 1,
        personName: "A",
      },
    ]);
  });
});

describe("loadFollowCredits", () => {
  it("reads followed filmography rows and skips junk", async () => {
    await withNeonFetch(
      {},
      unreachableNetwork,
      [
        {
          match: "talent_filmography",
          rows: [
            { person_id: 5, name: "Carpenter", tmdb_id: 10, media_type: "movie", role: "Director", poster_path: "/c.jpg" },
            { person_id: 6, name: "Jamie", tmdb_id: 20, media_type: "tv", role: "  ", poster_path: "nope" },
            { person_id: 9, name: null, tmdb_id: 4, media_type: "movie", role: null },
            { person_id: 10, name: "Roleless", tmdb_id: 5, media_type: "movie", role: null, poster_path: null },
            { person_id: 0, name: "Nope", tmdb_id: 1, media_type: "movie", role: "Cast" },
            { person_id: 7, name: "  ", tmdb_id: 2, media_type: "movie", role: "Cast" },
            { person_id: 8, name: "Bad", tmdb_id: 3, media_type: "book", role: "Cast" },
          ],
        },
      ],
      async () => {
        await expect(loadFollowCredits(testConn("follow-upcoming"), 1)).resolves.toEqual([
          { personId: 5, personName: "Carpenter", tmdbId: 10, mediaType: "movie", role: "Director", posterPath: "/c.jpg" },
          { personId: 6, personName: "Jamie", tmdbId: 20, mediaType: "tv", role: "Cast" },
          { personId: 10, personName: "Roleless", tmdbId: 5, mediaType: "movie", role: "Cast" },
        ]);
      },
    );
  });
});
