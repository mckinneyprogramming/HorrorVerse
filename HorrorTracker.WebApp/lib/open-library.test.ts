import { describe, expect, it } from "vitest";
import { openLibraryCoverUrl, parseOpenLibrarySearch, parseOpenLibraryWork, parseWorkId } from "./open-library";

describe("parseWorkId", () => {
  it("keeps an Open Library work id", () => {
    expect(parseWorkId("/works/OL45883W")).toBe("OL45883W");
    expect(parseWorkId("OL45883W")).toBe("OL45883W");
    expect(parseWorkId("book:1")).toBeUndefined();
  });
});

describe("parseOpenLibrarySearch", () => {
  it("maps title, author, year, subjects, and cover", () => {
    expect(
      parseOpenLibrarySearch({
        docs: [
          {
            key: "/works/OL45883W",
            title: "It",
            author_name: ["Stephen King"],
            first_publish_year: 1986,
            cover_i: 240727,
            subject: ["Horror", "Fiction"],
          },
          { key: "nope", title: "Skip" },
        ],
      }),
    ).toEqual([
      {
        sourceId: "OL45883W",
        title: "It",
        year: 1986,
        overview: "Stephen King · Horror, Fiction",
        coverUrl: "https://covers.openlibrary.org/b/id/240727-M.jpg",
      },
    ]);
  });
});

describe("parseOpenLibraryWork", () => {
  it("keeps the work description, edition facts, and subjects", () => {
    const book = parseOpenLibraryWork(
      "OL45883W",
      {
        title: "It",
        description: { value: "They all float." },
        covers: [99],
        subjects: ["Horror", "Derry"],
      },
      {
        author_name: ["Stephen King"],
        first_publish_year: 1986,
        number_of_pages_median: 1138,
        isbn: ["0451169514", "9781501142970"],
        publisher: ["Viking"],
        cover_i: 240727,
        subject: ["Horror"],
      },
    );

    expect(book).toMatchObject({
      sourceId: "OL45883W",
      title: "It",
      author: "Stephen King",
      year: 1986,
      pages: 1138,
      description: "They all float.",
      isbn: "9781501142970",
      publisher: "Viking",
      coverUrl: openLibraryCoverUrl(240727),
    });
    expect(book?.subjects).toEqual(["Horror", "Derry"]);
  });
});
