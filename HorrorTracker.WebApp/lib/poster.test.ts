import { describe, expect, it } from "vitest";
import { parsePosterPath, posterSize, posterUrl } from "./poster";

describe("parsePosterPath", () => {
  it("keeps a TMDb path and drops anything else", () => {
    expect(parsePosterPath("/abc123.jpg")).toBe("/abc123.jpg");
    expect(parsePosterPath("https://image.tmdb.org/t/p/w92/abc123.jpg")).toBeUndefined();
    expect(parsePosterPath("/../secret.jpg")).toBeUndefined();
    expect(parsePosterPath("-")).toBeUndefined();
  });
});

describe("posterUrl", () => {
  it("builds a TMDb image URL", () => {
    expect(posterUrl("/abc123.jpg")).toBe("https://image.tmdb.org/t/p/w92/abc123.jpg");
    expect(posterUrl("/abc123.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc123.jpg");
    expect(posterUrl(undefined)).toBeUndefined();
  });
});

describe("posterSize", () => {
  it("keeps TMDb thumbnail sizes and defaults the rest", () => {
    expect(posterSize("w780")).toBe("w780");
    expect(posterSize("original")).toBe("w500");
  });
});
