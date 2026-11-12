import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFollowedTalent, fetchTalentPerson, fetchTitleTalent, followTalent, unfollowTalent } from "./talent";

function respond(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const person = {
  id: 5,
  name: " Jamie ",
  profilePath: " /j.jpg ",
  knownFor: " Acting ",
  following: true,
  watched: 1,
  total: 2,
  credits: [
    null,
    { tmdbId: 0, title: "Zero", kind: "movie", mediaType: "movie" },
    { tmdbId: 8, title: " Halloween ", kind: "movie", mediaType: "movie", year: 1978, posterPath: " /h.jpg ", role: " Laurie ", vaultId: "movie:4", finished: true },
    { tmdbId: 9, title: "Show", kind: "show", mediaType: "tv", posterPath: "nope", vaultId: "book:1", role: "" },
    { tmdbId: 10, title: "Doc", kind: "documentary", mediaType: "movie" },
    { tmdbId: 11, title: "Person", kind: "movie", mediaType: "person" },
    { title: "Missing", kind: "game", mediaType: "movie", tmdbId: 3 },
  ],
};

describe("talent client", () => {
  it("reads title credits and drops people who are not usable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({})));
    await expect(fetchTitleTalent("movie:1")).resolves.toEqual({ directors: [], cast: [] });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond({
          directors: [null, { id: 0, name: "Zero" }, { id: 2, name: " Carpenter ", profilePath: " /c.jpg ", role: " Director " }, { id: 3, name: "N".repeat(210), role: "R".repeat(130) }, { name: "No id" }],
          cast: "nope",
        }),
      ),
    );
    await expect(fetchTitleTalent("movie:1")).resolves.toEqual({
      directors: [
        { id: 2, name: "Carpenter", profilePath: "/c.jpg", role: "Director" },
        { id: 3, name: "N".repeat(200), role: "R".repeat(120) },
      ],
      cast: [],
    });
  });

  it("reads a person, a follow list, and follow changes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({ person })));
    const opened = await fetchTalentPerson(5);
    expect(opened.credits.map((credit) => credit.tmdbId)).toEqual([8, 9, 10]);
    expect(opened.credits[0]).toMatchObject({ vaultId: "movie:4", posterPath: "/h.jpg", year: 1978, finished: true });
    expect(opened.credits[1]?.vaultId).toBeUndefined();
    expect(opened.credits[1]?.posterPath).toBeUndefined();
    expect(opened.knownFor).toBe("Acting");
    await expect(followTalent(5)).resolves.toMatchObject({ following: true });
    await expect(unfollowTalent(5)).resolves.toMatchObject({ id: 5 });

    vi.stubGlobal("fetch", vi.fn(async () => respond({ people: [person, null, { id: 1 }] })));
    const follows = await fetchFollowedTalent();
    expect(follows).toEqual([{ id: 5, name: "Jamie", profilePath: "/j.jpg", knownFor: "Acting", watched: 1, total: 2 }]);

    vi.stubGlobal("fetch", vi.fn(async () => respond({ people: "nope" })));
    await expect(fetchFollowedTalent()).resolves.toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => respond({ person: { id: 4, name: "Plain", credits: "nope" } })));
    await expect(fetchTalentPerson(4)).resolves.toMatchObject({ credits: [], watched: 0, total: 0, following: false });
  });

  it("uses the server message when a request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond("nope", 500)));
    await expect(fetchTitleTalent("movie:1")).rejects.toThrow("Could not load the people on that title.");
    await expect(fetchTalentPerson(5)).rejects.toThrow("Could not open that person.");
    await expect(fetchFollowedTalent()).rejects.toThrow("Could not load the people you follow.");
    await expect(followTalent(5)).rejects.toThrow("Could not follow that person.");
    await expect(unfollowTalent(5)).rejects.toThrow("Could not unfollow that person.");

    vi.stubGlobal("fetch", vi.fn(async () => respond({ error: "TMDb is down" }, 503)));
    await expect(fetchTitleTalent("movie:1")).rejects.toThrow("TMDb is down");
    await expect(followTalent(5)).rejects.toThrow("TMDb is down");
    vi.stubGlobal("fetch", vi.fn(async () => respond({})));
    await expect(fetchTalentPerson(5)).rejects.toThrow("Could not open that person.");
    await expect(unfollowTalent(5)).rejects.toThrow("Could not unfollow that person.");
  });
});
