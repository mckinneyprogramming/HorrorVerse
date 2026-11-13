import { afterEach, describe, expect, it } from "vitest";
import { installApi, sessionStep, type ApiHandle } from "../test-helpers/api";
import { resetTalentSchema, selectFilmography, selectTitleCredits, followTalent, listFollowedTalent, listFollowUpcoming, openTalent, titleCredits, unfollowTalent } from "./talent";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
  resetTalentSchema();
});

const jamie = {
  id: 500,
  name: " Jamie Lee ",
  profile_path: "/jamie.jpg",
  known_for_department: " Acting ",
  combined_credits: {
    cast: [
      { id: 15, media_type: "movie", title: "Halloween", release_date: "1978-10-25", genre_ids: [27], character: "Laurie", poster_path: "/h.jpg" },
      { id: 15, media_type: "movie", title: "Halloween", genre_ids: [27], character: "" },
      { id: 20, media_type: "movie", title: "Later", genre_ids: [27], character: "Lead" },
      { id: 23, media_type: "movie", title: "Alpha", release_date: "2020-02-01", genre_ids: [27], character: "A" },
      { id: 24, media_type: "movie", title: "Zed", genre_ids: [27], character: "A" },
      { id: 26, media_type: "movie", title: "Yarn", genre_ids: [27], character: "A" },
      { id: 22, media_type: "movie", title: " ", genre_ids: [27], character: "Blank" },
      { id: 16, media_type: "movie", title: "Doc", release_date: "2010-01-01", genre_ids: [27, 99], character: "Narrator" },
      { id: 17, media_type: "tv", name: "The Zone", first_air_date: "2019-04-01", genre_ids: [27], character: "" },
      { id: 18, media_type: "movie", title: "Thriller", genre_ids: [53], character: "Guest" },
      { media_type: "movie", title: "No Id", genre_ids: [27] },
      { id: 19, media_type: "person", title: "Self", genre_ids: [27] },
      null,
    ],
    crew: [
      { id: 15, media_type: "movie", title: "Halloween", job: "Director", genre_ids: [27], poster_path: "nope", release_date: "nope" },
      { id: 20, media_type: "movie", title: "Later", job: " director ", genre_ids: [27], release_date: "2020-05-01", poster_path: "/later.jpg" },
      { id: 20, media_type: "movie", title: "Later", job: "Director", genre_ids: [27] },
      { id: 17, media_type: "tv", name: "The Zone", job: "Director", genre_ids: [27] },
      { id: 21, media_type: "movie", title: "Assistant", job: "Assistant Director", genre_ids: [27] },
      { id: 25, media_type: "movie", title: "No Job", genre_ids: [27] },
    ],
  },
};

describe("title credits", () => {
  it("keeps the director and the first billed cast", () => {
    const credits = selectTitleCredits({
      crew: [
        null,
        { id: 1, name: "  ", job: "Director" },
        { name: "Missing", job: "Director" },
        { id: 2, name: "Carpenter", job: " Director ", profile_path: "/c.jpg" },
        { id: 2, name: "Carpenter", job: "Director" },
        { id: 3, name: "Assistant", job: "Assistant Director" },
        { id: 11, name: "No Job" },
        { id: 4, name: "Two", job: "Director" },
        { id: 5, name: "Three", job: "Director" },
        { id: 6, name: "Four", job: "Director" },
        { id: 7, name: "Five", job: "Director" },
      ],
      cast: [
        { id: 9, name: "Later", order: 2, character: "Z" },
        { id: 8, name: "First", order: 0, character: ` ${"L".repeat(90)} `, profile_path: "/a.jpg" },
        { id: 8, name: "First", order: 0, character: "Again" },
        { id: 10, name: "Unbilled", character: "" },
        { id: 0, name: "Zero" },
        null,
        "nope",
        { id: 11, name: "Six", order: 6 },
        { id: 12, name: "Seven", order: 7 },
        { id: 13, name: "Eight", order: 8 },
        { id: 14, name: "Nine", order: 9 },
        { id: 15, name: "Ten", order: 10 },
        { id: 16, name: "Eleven", order: 11 },
      ],
    });

    expect(credits.directors.map((person) => person.id)).toEqual([2, 4, 5, 6]);
    expect(credits.directors[0]).toMatchObject({ name: "Carpenter", role: "Director", profilePath: "/c.jpg" });
    expect(credits.cast).toHaveLength(8);
    expect(credits.cast[0]).toMatchObject({ id: 8, role: "L".repeat(80), profilePath: "/a.jpg" });
    expect(credits.cast[2]?.role).toBe("Cast");
    expect(selectTitleCredits({})).toEqual({ directors: [], cast: [] });
  });
});

describe("filmography", () => {
  it("keeps horror acting and directing credits and drops the rest", () => {
    const film = selectFilmography(jamie);
    expect(film).toMatchObject({ name: "Jamie Lee", profilePath: "/jamie.jpg", knownFor: "Acting" });
    expect(film.credits.map((credit) => [credit.tmdbId, credit.kind, credit.role, credit.year])).toEqual([
      [23, "movie", "A", 2020],
      [20, "movie", "Lead · Director", 2020],
      [17, "show", "Director", 2019],
      [16, "documentary", "Narrator", 2010],
      [15, "movie", "Laurie · Director", 1978],
      [26, "movie", "A", undefined],
      [24, "movie", "A", undefined],
    ]);
    expect(film.credits.find((credit) => credit.tmdbId === 15)?.posterPath).toBe("/h.jpg");
    expect(film.credits.find((credit) => credit.tmdbId === 20)?.posterPath).toBe("/later.jpg");

    const unnamed = selectFilmography({ name: " ", combined_credits: [] });
    expect(unnamed.name).toBe("");
    expect(unnamed.profilePath).toBeUndefined();
    expect(unnamed.knownFor).toBeUndefined();

    const many = Array.from({ length: 121 }, (_, index) => ({
      id: index + 1,
      media_type: "movie",
      title: `Film ${String(index + 1).padStart(3, "0")}`,
      release_date: `${1888 + index}-01-01`,
      genre_ids: [27],
      character: "A",
    }));
    expect(selectFilmography({ name: "Busy", combined_credits: { cast: many } }).credits).toHaveLength(120);
    expect(selectFilmography({ name: "Busy", combined_credits: { cast: many } }).credits[0]?.title).toBe("Film 121");
  });
});

describe("talent lookups", () => {
  it("reads directors and cast for a vault movie, show, or documentary", async () => {
    handle = installApi([{ match: "SELECT tmdbid FROM movie", rows: [{ tmdbid: 15 }] }], {
      env: { TMDBKey: "key" },
      external: [{ match: "/movie/15/credits", body: { crew: [{ id: 2, name: "Carpenter", job: "Director" }], cast: [] } }],
    });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "book:1")).resolves.toEqual({ directors: [], cast: [] });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "movie:0")).resolves.toEqual({ directors: [], cast: [] });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "movie:4")).resolves.toEqual({
      directors: [{ id: 2, name: "Carpenter", role: "Director" }],
      cast: [],
    });

    handle.restore();
    resetTalentSchema();
    handle = installApi(
      [
        { match: "SELECT tmdbid FROM show", rows: [{ tmdbid: 9 }] },
        { match: "SELECT tmdbid FROM documentary", rows: [{}] },
        { match: "SELECT tmdbid FROM movie", rows: [{ tmdbid: 15 }] },
      ],
      {
        env: { TMDBKey: "key" },
        external: [
          { match: "/tv/9/credits", body: { crew: [{ id: 3, name: "Show Director", job: "Director" }] } },
          { match: "/movie/15/credits", status: 404 },
        ],
      },
    );
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "show:3")).resolves.toMatchObject({ directors: [{ id: 3, name: "Show Director" }] });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "documentary:6")).resolves.toEqual({ directors: [], cast: [] });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "movie:8")).resolves.toEqual({ directors: [], cast: [] });
  });

  it("retries schema setup after a failure and then reuses it", async () => {
    handle = installApi([{ match: "ALTER TABLE movie", error: "locked", once: true }], { env: { TMDBKey: "key" } });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "series:1")).rejects.toThrow("locked");
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "series:1")).resolves.toEqual({ directors: [], cast: [] });
    await expect(titleCredits("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", "series:1")).resolves.toEqual({ directors: [], cast: [] });
    expect(handle.calls.filter((call) => call.query.includes("ALTER TABLE movie"))).toHaveLength(2);
  });

  it("matches upcoming titles to followed filmography", async () => {
    handle = installApi(
      [
        {
          match: "talent_filmography",
          rows: [{ person_id: 5, name: "Carpenter", tmdb_id: 10, media_type: "movie", role: "Director", poster_path: "/c.jpg" }],
        },
      ],
      { env: { TMDBKey: "key" } },
    );
    await expect(
      listFollowUpcoming("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, {
        films: [{ kind: "film", tmdbId: 10, title: "New Night", releaseDate: "2099-08-01", posterPath: "/n.jpg" }],
        shows: [],
      }),
    ).resolves.toEqual([
      {
        tmdbId: 10,
        kind: "film",
        title: "New Night",
        releaseDate: "2099-08-01",
        posterPath: "/n.jpg",
        personId: 5,
        personName: "Carpenter",
        role: "Director",
      },
    ]);
  });

  it("opens a person, matches the vault, and follows them", async () => {
    handle = installApi(
      [
        {
          match: "UNION ALL",
          rows: [
            { kind: "movie", id: 9, tmdbid: 15 },
            { kind: "movie", id: 4, tmdbid: 15 },
            { kind: "nope", id: 1, tmdbid: 2 },
            { id: 3, tmdbid: 9 },
          ],
        },
        { match: "user_media_progress", rows: [{ media_kind: "movie", media_id: 4 }, { media_kind: "", media_id: 1 }, { media_id: 5 }] },
        { match: "SELECT 1 FROM user_talent_follow", rows: [{ "?column?": 1 }] },
      ],
      { env: { TMDBKey: "key" }, external: [{ match: "/person/500", body: jamie }] },
    );
    const person = await openTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 500);
    expect(person).toMatchObject({ id: 500, name: "Jamie Lee", following: true, watched: 1, total: 7 });
    expect(person.credits.find((credit) => credit.tmdbId === 15)).toMatchObject({ vaultId: "movie:4", finished: true });
    expect(person.credits.find((credit) => credit.tmdbId === 20)?.vaultId).toBeUndefined();

    handle.restore();
    resetTalentSchema();
    handle = installApi(
      [
        {
          match: "UNION ALL",
          rows: [
            { kind: "movie", id: 9, tmdbid: 15 },
            { kind: "movie", id: 4, tmdbid: 15 },
          ],
        },
        { match: "user_media_progress", rows: [] },
        { match: "SELECT 1 FROM user_talent_follow", rows: [] },
      ],
      { env: { TMDBKey: "key" }, external: [{ match: "/person/500", body: jamie }] },
    );
    const unmatched = await openTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 500);
    expect(unmatched.credits.find((credit) => credit.tmdbId === 15)).toMatchObject({ vaultId: "movie:9", finished: false });
    expect(unmatched.watched).toBe(0);

    const followed = await followTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 500);
    expect(followed.following).toBe(true);
    expect(handle.calls.some((call) => call.query.includes("INSERT INTO user_talent_follow"))).toBe(true);
    await expect(openTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 0)).rejects.toThrow("Choose a person to open.");
    await expect(followTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 1.5)).rejects.toThrow("Choose a person to open.");
  });

  it("treats a missing or nameless TMDb person as not found", async () => {
    handle = installApi([], {
      env: { TMDBKey: "key" },
      external: [
        { match: "/person/7", status: 404 },
        { match: "/person/8", body: { name: " ", combined_credits: { cast: [], crew: [] } } },
      ],
    });
    await expect(openTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 7)).rejects.toThrow("That person was not found.");
    await expect(openTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 8)).rejects.toThrow("That person was not found.");
  });

  it("lists followed people from the cache and refreshes an empty one", async () => {
    handle = installApi(
      [
        {
          match: "SELECT person_id, name",
          rows: [
            { person_id: 5, name: " Jamie ", profile_path: "/j.jpg", known_for: " Acting " },
            { person_id: 0, name: "Nope" },
            { person_id: 6, name: " " },
            { person_id: 7, name: "New", profile_path: "http://no", known_for: " " },
            { person_id: 9, name: "Gone" },
          ],
        },
        {
          match: "SELECT media_type, tmdb_id",
          once: true,
          rows: [
            { media_type: "person", tmdb_id: 1, title: "Skip", kind: "movie", role: "Cast" },
            { media_type: "movie", tmdb_id: 8, title: " Cached ", kind: "movie", role: "Director", release_year: 1990, poster_path: "/c.jpg" },
            { media_type: "movie", tmdb_id: 4, title: "Bare", kind: "movie", role: "Cast" },
            { media_type: "tv", tmdb_id: 1, title: " ", kind: "show", role: "Cast" },
            { media_type: "movie", tmdb_id: 3, title: "Bad", kind: "book", role: "Cast" },
          ],
        },
        { match: "UNION ALL", rows: [{ kind: "movie", id: 2, tmdbid: 8 }] },
        { match: "user_media_progress", rows: [{ media_kind: "movie", media_id: 2 }] },
      ],
      {
        env: { TMDBKey: "key" },
        external: [
          { match: "/person/7", body: { id: 7, name: "New", combined_credits: { cast: [{ id: 30, media_type: "movie", title: "Fresh", genre_ids: [27], character: "A" }], crew: [] } } },
          { match: "/person/9", status: 404 },
        ],
      },
    );
    const people = await listFollowedTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1);
    expect(people.map((person) => ({ id: person.id, watched: person.watched, total: person.total, knownFor: person.knownFor }))).toEqual([
      { id: 5, watched: 1, total: 2, knownFor: "Acting" },
      { id: 7, watched: 0, total: 1, knownFor: undefined },
      { id: 9, watched: 0, total: 0, knownFor: undefined },
    ]);
    expect(people[0]?.profilePath).toBe("/j.jpg");
    expect(people[1]?.profilePath).toBeUndefined();
  });

  it("forgets a follow even when TMDb no longer has the person", async () => {
    handle = installApi([], {
      env: { TMDBKey: "key" },
      external: [{ match: "/person/7", status: 404 }],
    });
    await expect(unfollowTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 7)).resolves.toMatchObject({ id: 7, name: "Unknown", following: false, credits: [] });
    await expect(unfollowTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 0)).rejects.toThrow("Choose a person to open.");

    handle.restore();
    resetTalentSchema();
    handle = installApi([], { env: { TMDBKey: undefined } });
    await expect(unfollowTalent("postgresql://horror:secret@ep-test.neon.tech/HorrorVerse", 1, 7)).rejects.toThrow("TMDBKey is not configured.");
  });
});
