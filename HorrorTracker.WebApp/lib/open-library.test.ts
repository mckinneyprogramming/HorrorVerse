import { describe, expect, it } from "vitest";
import { jsonResponse, testConn, textResponse, unreachableNetwork, withNeonFetch } from "../test-helpers/http";
import { ensureBookColumns, importOpenLibraryBook, openLibraryCoverUrl, parseOpenLibrarySearch, parseOpenLibraryWork, parseWorkId, searchOpenLibrary } from "./open-library";

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

  it("lists horror subjects ahead of other matches", () => {
    const hits = parseOpenLibrarySearch({
      docs: [
        { key: "/works/OL1W", title: "It", subject: ["Cooking"] },
        { key: "/works/OL2W", title: "It", subject: ["Ghost stories"] },
      ],
    });
    expect(hits.map((hit) => hit.sourceId)).toEqual(["OL2W", "OL1W"]);
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

describe("open library parsing edges", () => {
  it("rejects ids and covers that are not usable", () => {
    expect(parseWorkId(null)).toBeUndefined();
    expect(parseWorkId("  OL12W  ")).toBe("OL12W");
    expect(parseWorkId("/works/")).toBeUndefined();
    expect(parseWorkId("ol1w")).toBeUndefined();
    expect(openLibraryCoverUrl(null)).toBeUndefined();
    expect(openLibraryCoverUrl(0)).toBeUndefined();
    expect(openLibraryCoverUrl(-2)).toBeUndefined();
    expect(openLibraryCoverUrl(1.5)).toBeUndefined();
    expect(openLibraryCoverUrl("10")).toBe("https://covers.openlibrary.org/b/id/10-M.jpg");
    expect(openLibraryCoverUrl("nope")).toBeUndefined();
  });

  it("sorts tied horror hits, drops empty docs, and caps the list", () => {
    expect(parseOpenLibrarySearch(null)).toEqual([]);
    expect(parseOpenLibrarySearch({ docs: "no" })).toEqual([]);
    expect(parseOpenLibrarySearch({ docs: [null, { key: "/works/OL9W", title: "Bare" }] })).toEqual([
      { sourceId: "OL9W", title: "Bare" },
    ]);

    const tied = parseOpenLibrarySearch({
      docs: [
        { key: "/works/OL1W", title: "A", subject: ["Horror"] },
        { key: "/works/OL2W", title: "B", subject: ["Horror"] },
        { key: "/works/OL3W", title: "C", author_name: ["Only Author"] },
        { key: "/works/OL4W", title: "D", subject: ["One", "Two", "Three", "Four"] },
      ],
    });
    expect(tied.map((hit) => hit.sourceId)).toEqual(["OL1W", "OL2W", "OL3W", "OL4W"]);
    expect(tied[2]?.overview).toBe("Only Author");
    expect(tied[3]?.overview).toBe("One, Two, Three");

    const docs = Array.from({ length: 9 }, (_, index) => ({
      key: `/works/OL${index + 1}W`,
      title: `Title ${index}`,
      subject: ["Horror"],
    }));
    expect(parseOpenLibrarySearch({ docs })).toHaveLength(8);
  });

  it("builds a title from the work, the search doc, or neither", () => {
    expect(parseOpenLibraryWork("nope", { title: "It" }, { title: "It" })).toBeUndefined();
    expect(parseOpenLibraryWork("OL1W", {}, {})).toBeUndefined();
    expect(parseOpenLibraryWork("OL1W", {}, { title: "From Search" })).toMatchObject({ title: "From Search", year: 0, pages: 0 });

    const combined = parseOpenLibraryWork("OL2W", { title: "It", subtitle: "A novel" }, { subtitle: "Ignored" });
    expect(combined?.title).toBe("It: A novel");

    const contained = parseOpenLibraryWork("OL3W", { title: "It: A novel", subtitle: "A novel" }, {});
    expect(contained?.title).toBe("It: A novel");

    const longTitle = "T".repeat(150);
    const longSubtitle = "S".repeat(60);
    expect(parseOpenLibraryWork("OL4W", { title: longTitle, subtitle: longSubtitle }, {})?.title).toBe(longTitle);

    const described = parseOpenLibraryWork("OL5W", {
      title: "Plain",
      description: "A string description.",
      covers: [4],
      subjects: ["Horror", "horror", "ewkoyjfa", "Derry"],
    }, {
      description: { value: 5 },
      author_name: ["N".repeat(80), "O".repeat(80), "P".repeat(80), "Q".repeat(80), "R".repeat(80)],
      first_publish_year: 1,
      number_of_pages_median: 1,
      isbn: ["978-1501142970"],
      publisher: ["Viking Press"],
      subject: ["Derry", "Ghost stories"],
    });
    expect(described).toMatchObject({
      description: "A string description.",
      year: 1,
      pages: 1,
      isbn: "9781501142970",
      publisher: "Viking Press",
      coverUrl: openLibraryCoverUrl(4),
    });
    expect(described?.author?.length).toBe(180);
    expect(described?.subjects).toEqual(["Horror", "ewkoyjfa", "Derry", "Ghost stories"]);

    const isbn10 = parseOpenLibraryWork("OL6W", { title: "Ten", description: { value: "From the object." } }, {
      isbn: ["0451169514", "abc"],
      first_publish_year: 3000,
      number_of_pages_median: 12,
      publisher: ["  "],
    });
    expect(isbn10).toMatchObject({ isbn: "0451169514", description: "From the object.", year: 3000, pages: 12 });
    expect(isbn10?.publisher).toBeUndefined();
    expect(isbn10?.coverUrl).toBeUndefined();

    const unusable = parseOpenLibraryWork("OL7W", { title: "None", description: { value: 5 } }, {
      isbn: ["abc"],
      first_publish_year: 0,
      number_of_pages_median: 1.5,
      author_name: [],
      subject: "Horror",
    });
    expect(unusable).toMatchObject({ year: 0, pages: 0, subjects: [] });
    expect(unusable?.isbn).toBeUndefined();
    expect(unusable?.author).toBeUndefined();
    expect(unusable?.description).toBeUndefined();

    expect(parseOpenLibraryWork("OL9W", { title: `${"A".repeat(159)} ${"B".repeat(5)}` }, {})?.title).toBe("A".repeat(159));
    expect(parseOpenLibraryWork("OL8W", { title: "Overflow", description: 5 }, {
      first_publish_year: 3001,
      number_of_pages_median: 0,
    })?.year).toBe(0);
  });
});

describe("open library requests", () => {
  const connection = testConn("open-library");

  function library(work: unknown, doc?: unknown, status = 200) {
    return (url: string) => {
      if (status !== 200) {
        return jsonResponse({}, status);
      }

      if (url.includes("/works/")) {
        return jsonResponse(work);
      }

      return jsonResponse({ docs: doc ? [doc] : [] });
    };
  }

  it("searches Open Library", async () => {
    await withNeonFetch({}, (url) => {
      expect(url).toContain("https://openlibrary.org/search.json?q=It");
      return jsonResponse({
        docs: [{ key: "/works/OL45883W", title: "It", author_name: ["Stephen King"], first_publish_year: 1986 }],
      });
    }, [], async () => {
      await expect(searchOpenLibrary("It")).resolves.toMatchObject([{ sourceId: "OL45883W", title: "It" }]);
    });
  });

  it("fails when search is not OK or is not JSON", async () => {
    await withNeonFetch({}, () => jsonResponse({}, 500), [], async () => {
      await expect(searchOpenLibrary("It")).rejects.toMatchObject({ status: 502, message: "Could not reach Open Library." });
    });

    await withNeonFetch({}, () => textResponse("nope", 200), [], async () => {
      await expect(searchOpenLibrary("It")).rejects.toThrow(SyntaxError);
    });
  });

  it("inserts a new book and updates an existing one", async () => {
    const work = {
      title: "It",
      description: { value: "They all float." },
      covers: [4],
      subjects: ["Horror", "horror", "ewkoyjfa", "Derry"],
    };
    const doc = {
      title: "It",
      author_name: ["Stephen King"],
      first_publish_year: 1986,
      number_of_pages_median: 1138,
      isbn: ["0451169514", "9781501142970"],
      publisher: ["Viking"],
      cover_i: 240727,
      subject: ["Ghost stories"],
    };

    await withNeonFetch({}, library(work, doc), [
      { match: "INSERT INTO book", rows: [{ id: 7 }] },
    ], async (neon) => {
      await expect(importOpenLibraryBook(connection, "/works/OL45883W")).resolves.toEqual({ added: 1, id: "book:7" });
      expect(neon.calls.some((call) => call.params.includes("ewkoyjfa"))).toBe(true);
      expect(neon.calls.find((call) => call.query.includes("INSERT INTO book"))?.params).toEqual(["It", 1138, 1986, "OL45883W"]);
    });

    await withNeonFetch({}, library({ title: "Bare" }), [
      { match: "INSERT INTO book", rows: [{ id: 8 }] },
    ], async (neon) => {
      await expect(importOpenLibraryBook(connection, "OL8W")).resolves.toEqual({ added: 1, id: "book:8" });
      const update = neon.calls.find((call) => call.query.startsWith("UPDATE book"));
      expect(update?.params.slice(5)).toEqual([null, null, null, null, null]);
    });

    await withNeonFetch({}, library(work, doc), [
      { match: "WHERE openlibraryid", rows: [{ id: 6 }] },
    ], async (neon) => {
      await expect(importOpenLibraryBook(connection, "OL45883W")).resolves.toEqual({ added: 0, id: "book:6" });
      expect(neon.calls.some((call) => call.query.includes("INSERT INTO book"))).toBe(false);
    });
  });

  it("rejects a bad id, a missing book, and a failed insert", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await expect(importOpenLibraryBook(connection, "book")).rejects.toMatchObject({ status: 400, message: "Choose an Open Library book to add." });
      expect(neon.calls).toEqual([]);
    });

    await withNeonFetch({}, library({}, undefined), [], async () => {
      await expect(importOpenLibraryBook(connection, "OL1W")).rejects.toMatchObject({ status: 502, message: "Open Library did not return that book." });
    });

    await withNeonFetch({}, library({ title: "It" }, { title: "It" }), [], async () => {
      await expect(importOpenLibraryBook(connection, "OL1W")).rejects.toMatchObject({ status: 500, message: "Could not save that book." });
    });

    await withNeonFetch({}, () => jsonResponse({}, 500), [], async () => {
      await expect(importOpenLibraryBook(connection, "OL1W")).rejects.toMatchObject({ status: 502 });
    });

    await withNeonFetch({}, (url) => url.includes("/works/") ? textResponse("nope", 200) : jsonResponse({ docs: [] }), [], async () => {
      await expect(importOpenLibraryBook(connection, "OL1W")).rejects.toThrow(SyntaxError);
    });
  });

  it("creates the book columns", async () => {
    await withNeonFetch({}, unreachableNetwork, [], async (neon) => {
      await ensureBookColumns(connection);
      expect(neon.calls.length).toBeGreaterThanOrEqual(7);
    });
  });
});
