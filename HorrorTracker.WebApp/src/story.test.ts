// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "./catalog";
import {
  finishedTitleCount,
  kindLabel,
  recapItemsFromCatalog,
  recapStoryCopy,
  renderRecapStoryCard,
  renderTitleStoryCard,
  storyFilename,
  storyTag,
  titleKicker,
  titleStoryCopy,
  watchedByline,
} from "./story";

const scream: CatalogEntry = {
  id: "movie:1",
  mediaId: 1,
  title: "Scream",
  kind: "movie",
  completed: true,
  releaseYear: 1996,
  totalTime: 111,
  seriesTitle: "Scream",
  keywords: ["slasher", "mask"],
};

const alien: CatalogEntry = {
  id: "series:10",
  mediaId: 10,
  title: "Alien",
  kind: "series",
  completed: true,
};

describe("titleStoryCopy", () => {
  it("adds runtime, series, and a tag beside year and kind", () => {
    expect(
      titleStoryCopy({
        title: "Scream",
        year: 1996,
        kind: "movie",
        displayName: "Riley",
        seriesTitle: "Scream",
        totalTime: 111,
        keywords: ["slasher"],
      }),
    ).toEqual({
      kicker: titleKicker("Scream"),
      title: "Scream",
      meta: "1996 · Movies · 1 hr 51 min",
      series: "Scream",
      tag: "Slashers",
      byline: "Watched by Riley",
    });
  });

  it("picks a stable kicker and omits empty extras", () => {
    const copy = titleStoryCopy({ title: "The Thing", kind: "movie", displayName: "  " });
    expect(copy.kicker).toBe(titleKicker("The Thing"));
    expect(copy.meta).toBe("Movies");
    expect(copy.series).toBeUndefined();
    expect(copy.tag).toBeUndefined();
  });

  it("does not repeat the title as a series on series cards", () => {
    expect(titleStoryCopy({ title: "Alien", kind: "series", displayName: "Riley", seriesTitle: "Alien" }).series).toBeUndefined();
  });

  it("names the watch year on the byline", () => {
    expect(titleStoryCopy({ title: "Ratched", kind: "show", displayName: "Riley", watchedIn: 2020 }).byline).toBe(
      "Watched in 2020 by Riley",
    );
  });
});

describe("watchedByline", () => {
  it("falls back to a nameless survivor", () => {
    expect(watchedByline("  ")).toBe("Watched by a survivor");
  });
});

describe("recapStoryCopy", () => {
  it("lists hours, extras, and recent titles", () => {
    const copy = recapStoryCopy({
      hoursLabel: "12 hr",
      finishedCount: 3,
      items: [
        { title: "Scream", posterPath: "/scream.jpg" },
        { title: "Aliens" },
        { title: "The Thing" },
      ],
      allNighters: 2,
      longestNight: "Aliens",
    });
    expect(copy.empty).toBe(false);
    expect(copy.heading).toBe("Your nights");
    expect(copy.hours).toBe("12 hr");
    expect(copy.count).toBe("3 titles survived");
    expect(copy.extras).toEqual(["2 all-nighters", "Longest night · Aliens"]);
    expect(copy.items).toEqual([
      { title: "Scream", posterPath: "/scream.jpg" },
      { title: "Aliens" },
      { title: "The Thing" },
    ]);
  });

  it("explains an empty vault", () => {
    const copy = recapStoryCopy({ hoursLabel: "   ", finishedCount: 0, items: [] });
    expect(copy.empty).toBe(true);
    expect(copy.hours).toBe("0 hr");
    expect(copy.count).toContain("Mark a title finished");
    expect(copy.extras).toEqual([]);
    expect(copy.items).toEqual([]);
  });
});

describe("storyTag", () => {
  it("uses the first library tag that matches keywords", () => {
    expect(storyTag(["found footage", "cabin"])).toBe("Found footage");
  });
});

describe("recapItemsFromCatalog", () => {
  it("skips series and keeps catalog order of recent ids", () => {
    expect(
      recapItemsFromCatalog([{ ...scream, posterPath: "/scream.jpg" }, alien], ["series:10", "movie:1"], {
        "movie:1": "/ignored.jpg",
      }),
    ).toEqual([{ title: "Scream", posterPath: "/scream.jpg" }]);
  });

  it("uses extra poster paths when the catalog row has none", () => {
    expect(recapItemsFromCatalog([scream, alien], ["movie:1"], { "movie:1": "/extra.jpg" })).toEqual([
      { title: "Scream", posterPath: "/extra.jpg" },
    ]);
  });
});

describe("finishedTitleCount", () => {
  it("ignores series marks so recaps do not double-count sagas", () => {
    expect(finishedTitleCount([scream, alien], ["movie:1", "series:10"])).toBe(1);
  });
});

describe("storyFilename", () => {
  it("slugifies the title", () => {
    expect(storyFilename("Scream (1996)")).toBe("horrorverse-scream-1996.png");
    expect(storyFilename("!!!")).toBe("horrorverse-story.png");
    expect(storyFilename(` ${"Night".repeat(20)} `).length).toBeLessThanOrEqual("horrorverse-".length + 40 + ".png".length);
  });
});

describe("story copy edges", () => {
  it("fills blank titles and trims extras", () => {
    expect(kindLabel("movie")).toBe("Movies");
    expect(kindLabel("nope" as CatalogEntry["kind"])).toBe("nope");
    expect(titleKicker("")).toBeTruthy();
    expect(storyTag(undefined)).toBeUndefined();
    expect(storyTag([])).toBeUndefined();
    expect(storyTag(["romance"])).toBeUndefined();
    expect(titleStoryCopy({ title: "   ", kind: "movie", displayName: "Riley", seriesTitle: "   ", year: 0 }).title).toBe("Untitled");
    expect(watchedByline("Riley", 1996)).toBe("Watched in 1996 by Riley");

    const single = recapStoryCopy({
      hoursLabel: "   ",
      finishedCount: 1,
      items: [{ title: " Scream ", posterPath: "nope" }, { title: "   " }, ...Array.from({ length: 6 }, (_, index) => ({ title: `Night ${index}` }))],
      allNighters: 1,
      longestNight: "   ",
    });
    expect(single.hours).toBe("0 hr");
    expect(single.count).toBe("1 title survived");
    expect(single.items).toHaveLength(5);
    expect(single.extras).toEqual(["1 all-nighter"]);

    const counted = recapStoryCopy({
      hoursLabel: "2 hr",
      finishedCount: 0,
      items: [{ title: "Scream" }, { title: "Alien" }],
      allNighters: -1,
    });
    expect(counted.empty).toBe(false);
    expect(counted.count).toBe("2 titles survived");
    expect(counted.extras).toEqual([]);
  });

  it("stops after five recent titles and skips unknown ids", () => {
    const entries = Array.from({ length: 6 }, (_, index) => ({
      ...scream,
      id: `movie:${index}`,
      title: `Night ${index}`,
      posterPath: index === 0 ? undefined : "/ok.jpg",
    }));
    expect(recapItemsFromCatalog(entries, ["missing", ...entries.map((entry) => entry.id)], { "movie:0": "nope" })).toHaveLength(5);
  });
});

class FakeBitmap {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

function htmlImage(naturalWidth: number, naturalHeight: number, width = naturalWidth, height = naturalHeight): HTMLImageElement {
  const image = document.createElement("img");
  Object.defineProperty(image, "naturalWidth", { configurable: true, get: () => naturalWidth });
  Object.defineProperty(image, "naturalHeight", { configurable: true, get: () => naturalHeight });
  Object.defineProperty(image, "width", { configurable: true, get: () => width });
  Object.defineProperty(image, "height", { configurable: true, get: () => height });
  return image;
}

function installCanvas(blob: Blob | null = new Blob(["png"], { type: "image/png" }), context = true) {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    lineWidth: 1,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: String(text).length > 12 ? 10_000 : 20 })),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    createLinearGradient: vi.fn(() => gradient),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => (context ? (ctx as unknown as CanvasRenderingContext2D) : null));
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(blob);
  });
  return ctx;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("story cards", () => {
  it("draws a title card with a poster, tag, and avatar", async () => {
    installCanvas();
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
    const bitmaps = [htmlImage(100, 150), htmlImage(0, 0, 40, 60)];
    vi.stubGlobal("createImageBitmap", async () => bitmaps.shift() ?? htmlImage(10, 10));
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 16;
        height = 16;
        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } })),
    );

    const blob = await renderTitleStoryCard({
      title: "Scream",
      year: 1996,
      kind: "movie",
      displayName: "Riley",
      seriesTitle: "Scream",
      totalTime: 111,
      keywords: ["slasher"],
      watchedIn: 1996,
      avatar: "https://avatar.example/riley.png",
      posterPath: "/scream.jpg",
    });
    expect(blob.type).toBe("image/png");
    await renderTitleStoryCard({
      title: "Alien",
      kind: "movie",
      displayName: "Riley",
      posterPath: "/alien.jpg",
    });
  });

  it("draws a title without a poster and a recap with mixed art", async () => {
    installCanvas();
    Object.defineProperty(document, "fonts", { configurable: true, value: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("missing")) {
          return new Response("no", { status: 404 });
        }

        if (url.includes("text")) {
          return new Response("hi", { status: 200, headers: { "content-type": "text/plain" } });
        }

        if (url.includes("empty")) {
          return new Response(new Uint8Array(), { status: 200, headers: { "content-type": "image/png" } });
        }

        if (url.includes("throw")) {
          throw new Error("offline");
        }

        return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
      }),
    );
    vi.stubGlobal("Image", undefined);
    vi.stubGlobal("ImageBitmap", undefined);
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4, height: 4 }));
    await renderTitleStoryCard({
      title: "Scream",
      kind: "movie",
      displayName: "Riley",
      avatar: "https://avatar.example/riley.png",
      posterPath: "/plain.jpg",
    });

    for (const posterPath of ["/missing.jpg", "/text.jpg", "/empty.jpg", "/throw.jpg", "nope"]) {
      await renderTitleStoryCard({ title: "Scream", kind: "movie", displayName: "Riley", posterPath });
    }

    const bitmaps = [new FakeBitmap(12, 18), { width: 8, height: 9 }, {}];
    vi.stubGlobal("ImageBitmap", FakeBitmap);
    vi.stubGlobal("createImageBitmap", async () => bitmaps.shift() ?? {});
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 12;
        height = 12;
        set src(_value: string) {
          this.onload?.();
        }
      },
    );

    await renderTitleStoryCard({
      title: "supercalifragilistic bravo charlie delta echo foxtrot",
      kind: "" as CatalogEntry["kind"],
      displayName: "Riley",
    });
    await renderRecapStoryCard({
      hoursLabel: "12 hr",
      finishedCount: 4,
      displayName: "   ",
      allNighters: 2,
      longestNight: "Aliens",
      avatar: "https://avatar.example/riley.png",
      items: [
        { title: "Posted", posterPath: "/good.jpg" },
        { title: "Second", posterPath: "/second.jpg" },
        { title: "Third", posterPath: "/third.jpg" },
        { title: "Missing poster", posterPath: "/missing.jpg" },
        { title: "Plain words here now" },
      ],
    });
    await renderRecapStoryCard({
      hoursLabel: "1 hr",
      finishedCount: 1,
      displayName: "Riley",
      items: [],
    });
  });

  it("uses a blob image when createImageBitmap is unavailable", async () => {
    installCanvas();
    vi.stubGlobal("createImageBitmap", undefined);
    let fail = false;
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 8;
        height = 8;
        set src(_value: string) {
          queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
        }
      },
    );
    URL.createObjectURL = () => "blob:story";
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } })),
    );

    await renderTitleStoryCard({
      title: "Scream",
      kind: "movie",
      displayName: "Riley",
      posterPath: "/scream.jpg",
      avatar: "https://avatar.example/riley.png",
    });

    fail = true;
    await renderTitleStoryCard({
      title: "Scream",
      kind: "movie",
      displayName: "Riley",
      posterPath: "/scream.jpg",
      avatar: "https://avatar.example/missing.png",
    });
  });

  it("rejects a canvas that cannot draw or export", async () => {
    installCanvas(null, false);
    await expect(renderTitleStoryCard({ title: "Scream", kind: "movie", displayName: "Riley" })).rejects.toThrow(
      "Could not draw that story image.",
    );

    installCanvas(null, true);
    await expect(renderTitleStoryCard({ title: "Scream", kind: "movie", displayName: "Riley" })).rejects.toThrow(
      "Could not create that story image.",
    );
  });

  it("skips font waiting when the document is missing", async () => {
    const current = globalThis.document;
    vi.stubGlobal("document", undefined);
    await expect(renderTitleStoryCard({ title: "Scream", kind: "movie", displayName: "Riley" })).rejects.toThrow();
    vi.stubGlobal("document", current);
  });
});
