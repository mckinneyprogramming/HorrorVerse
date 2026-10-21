import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allowedCover,
  createCatalogEntry,
  deleteCatalogEntry,
  fetchCatalog,
  formatRuntime,
  isMediaKind,
  MEDIA_KINDS,
  movieDetailLine,
  openLibraryCover,
  parsePosterPath,
  posterUrl,
  updateCatalogEntry,
  WRITABLE_KINDS,
  type CatalogEntry,
} from "./catalog";

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

describe("allowedCover", () => {
  it("rewrites legacy IGDB cover URLs to include /upload/", () => {
    expect(allowedCover("https://images.igdb.com/igdb/image/t_cover_big/co1r74.jpg")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg",
    );
    expect(allowedCover("https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg",
    );
    expect(allowedCover("https://covers.openlibrary.org/b/id/12-M.jpg")).toBe("https://covers.openlibrary.org/b/id/12-M.jpg");
    expect(allowedCover("https://covers.openlibrary.org/b/id/12-L.jpg")).toBeUndefined();
    expect(allowedCover("https://example.com/cover.jpg")).toBeUndefined();
    expect(allowedCover(null)).toBeUndefined();
    expect(openLibraryCover("https://covers.openlibrary.org/b/id/12-M.jpg")).toBe("https://covers.openlibrary.org/b/id/12-M.jpg");
    expect(openLibraryCover("nope")).toBeUndefined();
  });
});

describe("catalog helpers", () => {
  it("recognizes every media kind", () => {
    for (const kind of MEDIA_KINDS) {
      expect(isMediaKind(kind.id)).toBe(true);
    }

    expect(isMediaKind("opera")).toBe(false);
    expect(WRITABLE_KINDS.map((kind) => kind.id)).toEqual(MEDIA_KINDS.map((kind) => kind.id));
  });

  it("accepts a poster path and builds its image URL", () => {
    const valid = `/${"a".repeat(159)}`;
    expect(parsePosterPath(valid)).toBe(valid);
    expect(parsePosterPath("/abc.jpg")).toBe("/abc.jpg");
    expect(parsePosterPath(null)).toBeUndefined();
    expect(parsePosterPath("abc.jpg")).toBeUndefined();
    expect(parsePosterPath(`/${"a".repeat(160)}`)).toBeUndefined();
    expect(parsePosterPath("/a/../b.jpg")).toBeUndefined();
    expect(parsePosterPath("/a b.jpg")).toBeUndefined();
    expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w92/abc.jpg");
    expect(posterUrl(undefined)).toBeUndefined();
    expect(posterUrl("nope")).toBeUndefined();
  });

  it("formats runtimes", () => {
    expect(formatRuntime(undefined)).toBeUndefined();
    expect(formatRuntime(0)).toBeUndefined();
    expect(formatRuntime(0.4)).toBeUndefined();
    expect(formatRuntime(45)).toBe("45 min");
    expect(formatRuntime(60)).toBe("1 hr");
    expect(formatRuntime(90)).toBe("1 hr 30 min");
    expect(formatRuntime(120)).toBe("2 hr");
  });
});

describe("movieDetailLine kinds", () => {
  const base: CatalogEntry = { id: "movie:1", mediaId: 1, title: "Scream", kind: "movie", completed: false };

  it("describes books, games, podcasts, and timed titles", () => {
    expect(movieDetailLine({ ...base, kind: "book", pages: 1 })).toBe("1 page");
    expect(movieDetailLine({ ...base, kind: "book" })).toBeUndefined();
    expect(movieDetailLine({ ...base, kind: "game", developer: "Konami", releaseYear: 1999, platforms: "PS1" })).toBe(
      "Konami · 1999 · PS1",
    );
    expect(movieDetailLine({ ...base, kind: "game" })).toBeUndefined();
    expect(movieDetailLine({ ...base, kind: "podcast", releaseYear: 2018 })).toBe("2018");
    expect(movieDetailLine({ ...base, kind: "podcast" })).toBeUndefined();
    expect(movieDetailLine({ ...base, kind: "series" })).toBeUndefined();
    expect(movieDetailLine(base)).toBeUndefined();
    expect(movieDetailLine({ ...base, seriesTitle: "Scream", releaseYear: 1996, totalTime: 111 })).toBe(
      "Scream · 1996 · 1 hr 51 min",
    );
    expect(movieDetailLine({ ...base, kind: "documentary", totalTime: 60 })).toBe("1 hr");
    expect(movieDetailLine({ ...base, kind: "show", seriesTitle: "Zone" })).toBe("Zone");
  });
});

const minimal: CatalogEntry = { id: "movie:1", mediaId: 1, title: "Scream", kind: "movie", completed: false };

const full: CatalogEntry = {
  id: "book:2",
  mediaId: 2,
  title: "It",
  kind: "book",
  completed: true,
  totalTime: 12,
  releaseYear: 1986,
  seriesId: 3,
  seriesTitle: "King",
  totalEpisodes: 4,
  numberOfSeasons: 1,
  keywords: ["Ghost", "0"],
  posterPath: "/it.jpg",
  pages: 1138,
  author: "Stephen King",
  developer: "Dev",
  platforms: "PC",
  description: "Scary",
  coverUrl: "https://covers.openlibrary.org/b/id/99-M.jpg",
  isbn: "123",
  publisher: "Viking",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalog requests", () => {
  it("keeps valid rows and optional text from either casing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json([
          { id: "movie:1", mediaId: 1, title: "Scream", kind: "movie", completed: false },
          {
            id: "book:2",
            mediaId: 2,
            title: "It",
            kind: "book",
            completed: true,
            totalTime: 12,
            releaseYear: 1986,
            seriesId: 3,
            seriesTitle: " King ",
            totalEpisodes: 4,
            numberOfSeasons: 1,
            keywords: ["Ghost", "ghost", " ", "", 0, null],
            posterPath: "/it.jpg",
            pages: 1138,
            author: " Stephen King ",
            developer: " Dev ",
            platforms: " PC ",
            description: " Scary ",
            coverUrl: "https://covers.openlibrary.org/b/id/99-M.jpg",
            isbn: " 123 ",
            publisher: " Viking ",
          },
          {
            id: "show:4",
            mediaId: 4,
            title: "Zone",
            kind: "show",
            completed: false,
            totalTime: "45",
            releaseYear: 0,
            seriesId: "8",
            seriesTitle: "   ",
            totalEpisodes: "12",
            numberOfSeasons: "nope",
            Keywords: ["Anthology", "anthology", ""],
            PosterPath: "/zone.jpg",
            Pages: "300",
            Author: " Rod ",
            Developer: " ",
            Platforms: "TV",
            Description: "Odd",
            CoverUrl: "https://images.igdb.com/igdb/image/t_cover_big/co9.jpg",
            Isbn: "111",
            Publisher: "CBS",
          },
          {
            id: "documentary:5",
            mediaId: 5,
            title: "Cropsey",
            kind: "documentary",
            completed: true,
            totalTime: Number.POSITIVE_INFINITY,
            releaseYear: "1999",
            seriesId: -1,
            keywords: "nope",
            posterPath: "https://evil.example/x.jpg",
            pages: null,
            author: 12,
            coverUrl: "https://example.com/nope.jpg",
            description: "  Trim me  ",
          },
          {
            id: "podcast:6",
            mediaId: 6,
            title: "Lore",
            kind: "podcast",
            completed: false,
            totalTime: "",
            releaseYear: "  ",
            seriesId: "  ",
            totalEpisodes: "",
            numberOfSeasons: "  7  ",
            keywords: [],
            posterPath: `/${"b".repeat(160)}`,
          },
          null,
          { id: "movie:7", mediaId: "1", title: "X", kind: "movie", completed: false },
          { id: "movie:8", mediaId: 8, title: "X", kind: "opera", completed: false },
          { id: "movie:9", mediaId: 9, title: "X", kind: "movie", completed: "yes" },
          { title: "X" },
          "bad",
        ]),
      ),
    );

    await expect(fetchCatalog()).resolves.toEqual([
      minimal,
      full,
      {
        id: "show:4",
        mediaId: 4,
        title: "Zone",
        kind: "show",
        completed: false,
        totalTime: 45,
        seriesId: 8,
        totalEpisodes: 12,
        keywords: ["Anthology"],
        posterPath: "/zone.jpg",
        pages: 300,
        author: "Rod",
        platforms: "TV",
        description: "Odd",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co9.jpg",
        isbn: "111",
        publisher: "CBS",
      },
      {
        id: "documentary:5",
        mediaId: 5,
        title: "Cropsey",
        kind: "documentary",
        completed: true,
        releaseYear: 1999,
        description: "Trim me",
      },
      {
        id: "podcast:6",
        mediaId: 6,
        title: "Lore",
        kind: "podcast",
        completed: false,
        numberOfSeasons: 7,
      },
    ]);
  });

  it("returns nothing for a non-array body and writes a title back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({})));
    await expect(fetchCatalog()).resolves.toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => json(null)));
    await expect(fetchCatalog()).resolves.toEqual([]);

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      return json(minimal);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(createCatalogEntry({ title: "Scream", kind: "movie", completed: false, releaseYear: 1996 })).resolves.toEqual(minimal);
    await expect(updateCatalogEntry({ id: "movie:1", title: "Scream", completed: true })).resolves.toEqual(minimal);
    await deleteCatalogEntry("movie:1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Scream", kind: "movie", completed: false, releaseYear: 1996 }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog", expect.objectContaining({ method: "PATCH" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog?id=movie%3A1",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ id: "movie:1" }) }),
    );
  });

  it("raises server errors, a missing title, bad JSON, and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Duplicate" }, 409)));
    await expect(fetchCatalog()).rejects.toThrow("Catalog request failed (409)");
    await expect(createCatalogEntry({ title: "A", kind: "movie", completed: false })).rejects.toThrow("Duplicate");
    await expect(deleteCatalogEntry("movie:1")).rejects.toThrow("Duplicate");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(updateCatalogEntry({ id: "movie:1", title: "A", completed: false })).rejects.toThrow("Catalog request failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(deleteCatalogEntry("movie:1")).rejects.toThrow("Catalog request failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => json({ id: 1 })));
    await expect(createCatalogEntry({ title: "A", kind: "movie", completed: false })).rejects.toThrow("Catalog did not return a title.");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(fetchCatalog()).rejects.toThrow();
    await expect(updateCatalogEntry({ id: "movie:1", title: "A", completed: true })).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchCatalog()).rejects.toThrow("offline");
    await expect(createCatalogEntry({ title: "A", kind: "movie", completed: false })).rejects.toThrow("offline");
    await expect(deleteCatalogEntry("movie:1")).rejects.toThrow("offline");
  });
});
