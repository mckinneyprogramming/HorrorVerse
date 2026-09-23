import { describe, expect, it } from "vitest";
import { movieDetailLine, type CatalogEntry } from "./catalog";

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
