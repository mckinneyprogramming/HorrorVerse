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

  it("shows the year for a typed-in book, podcast, or game", () => {
    const book: CatalogEntry = { id: "book:1", mediaId: 1, title: "Night Shift", kind: "book", completed: false, releaseYear: 1978 };
    expect(movieDetailLine(book)).toBe("1978");
    expect(
      movieDetailLine({
        ...book,
        author: "Stephen King",
        pages: 326,
        publisher: "Doubleday",
      }),
    ).toBe("Stephen King · 1978 · 326 pages · Doubleday");
    expect(movieDetailLine({ ...book, kind: "podcast", releaseYear: undefined })).toBeUndefined();
  });
});

describe("posterUrl", () => {
  it("builds a TMDb thumbnail URL", () => {
    expect(posterUrl("/abc123.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc123.jpg");
  });
});
