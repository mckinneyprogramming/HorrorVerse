import { describe, expect, it } from "vitest";
import { formatPlace, parsePlace } from "./history";

describe("browser history places", () => {
  it("maps the home screen to the site root", () => {
    expect(formatPlace(parsePlace("/", ""))).toBe("/");
    expect(parsePlace("/missing", "").view).toBe("home");
  });

  it("keeps library kind, search, tag, and franchises in the address", () => {
    const place = parsePlace("/library", "?kind=movie&q=Scream&tag=slasher&franchises=1");
    expect(place).toMatchObject({
      view: "library",
      filter: "movie",
      query: "Scream",
      tag: "slasher",
      franchisesOpen: true,
    });
    expect(formatPlace(place)).toBe("/library?kind=movie&q=Scream&tag=slasher&franchises=1");
  });

  it("keeps a member profile on its own address", () => {
    expect(formatPlace(parsePlace("/profile/12", ""))).toBe("/profile/12");
    expect(parsePlace("/profile/nope", "").view).toBe("home");
  });

  it("drops unknown filters and keeps the other screens on their own paths", () => {
    expect(parsePlace("")).toEqual({
      view: "home",
      filter: "all",
      query: "",
      tag: "",
      franchisesOpen: false,
      profileId: null,
    });
    expect(parsePlace("/library/").view).toBe("library");
    expect(parsePlace("/profile").view).toBe("home");
    expect(parsePlace("/upcoming/", "?franchises=1")).toMatchObject({ view: "upcoming", franchisesOpen: false });
    expect(formatPlace(parsePlace("/stats"))).toBe("/stats");
    expect(formatPlace(parsePlace("/install"))).toBe("/install");
    expect(formatPlace(parsePlace("/account"))).toBe("/account");
    expect(formatPlace(parsePlace("/lists"))).toBe("/lists");
    expect(formatPlace(parsePlace("/library"))).toBe("/library");

    const noisy = parsePlace("/library", "?kind=nope&tag=nope&q=%20hello%20&franchises=0");
    expect(noisy).toMatchObject({ filter: "all", tag: "", query: "hello", franchisesOpen: false });
    expect(formatPlace({ ...noisy, query: "  hello  ", filter: "all", tag: "", franchisesOpen: false })).toBe("/library?q=hello");

    const long = "s".repeat(150);
    expect(parsePlace("/library", `?q=${long}`).query).toHaveLength(120);
    expect(formatPlace({ ...noisy, query: long, filter: "show", tag: "zombie", franchisesOpen: true })).toBe(
      `/library?kind=show&q=${"s".repeat(120)}&tag=zombie&franchises=1`,
    );
    expect(formatPlace({ ...noisy, view: "profile", profileId: 0 })).toBe("/account");
    expect(formatPlace({ ...noisy, view: "profile", profileId: null })).toBe("/account");
  });
});
