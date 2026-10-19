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
});
