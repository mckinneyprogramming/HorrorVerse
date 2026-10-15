import { describe, expect, it } from "vitest";
import { movieDetailLine, posterUrl, type CatalogEntry } from "./catalog";

const twilight2019: CatalogEntry = {
  id: "show:4",
  mediaId: 4,
  title: "The Twilight Zone",
  kind: "show",
  completed: false,
  releaseYear: 2019,
};

describe("movieDetailLine", () => {
  it("shows the air year for TV reboots with the same title", () => {
    expect(movieDetailLine(twilight2019)).toBe("2019");
  });
});

describe("posterUrl", () => {
  it("builds a TMDb thumbnail URL", () => {
    expect(posterUrl("/abc123.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc123.jpg");
  });
});
