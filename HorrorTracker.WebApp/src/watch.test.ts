import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWatch } from "./watch";

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

describe("fetchWatch", () => {
  it("reads providers and drops duplicates", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        title: " Scream ",
        region: " ca ",
        link: " https://watch.example/scream ",
        attribution: " Vault ",
        streaming: [
          { name: " Netflix ", logo: " https://logo.example/n.png " },
          { name: "netflix" },
          { Name: "Hulu", Logo: " https://logo.example/h.png " },
          { name: "   " },
          null,
          "bad",
          { name: "Shudder" },
        ],
        rent: [{ name: "Apple" }],
        buy: "nope",
        free: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWatch("movie:1")).resolves.toEqual({
      title: "Scream",
      region: "ca",
      link: "https://watch.example/scream",
      attribution: "Vault",
      streaming: [
        { name: "Netflix", logo: "https://logo.example/n.png" },
        { name: "Hulu", logo: "https://logo.example/h.png" },
        { name: "Shudder" },
      ],
      rent: [{ name: "Apple" }],
      buy: [],
      free: [],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/watch?id=movie%3A1");
  });

  it("accepts Pascal fields and fills missing offer text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          Title: "Alien",
          Region: "  ",
          Link: "   ",
          Attribution: "   ",
          Streaming: [{ Name: "Max" }],
          Rent: [],
          Buy: [{ name: "Vudu", logo: "   " }],
          Free: [{ Name: "Tubi" }],
        }),
      ),
    );

    await expect(fetchWatch("movie:2")).resolves.toEqual({
      title: "Alien",
      region: "US",
      streaming: [{ name: "Max" }],
      rent: [],
      buy: [{ name: "Vudu" }],
      free: [{ name: "Tubi" }],
      attribution: "JustWatch",
    });

    vi.stubGlobal("fetch", vi.fn(async () => json({ title: "Nosferatu", streaming: [{ logo: "https://logo.example/blank.png" }] })));
    await expect(fetchWatch("movie:4")).resolves.toEqual({
      title: "Nosferatu",
      region: "US",
      streaming: [],
      rent: [],
      buy: [],
      free: [],
      attribution: "JustWatch",
    });

    vi.stubGlobal("fetch", vi.fn(async () => json({ title: "Carrie", link: "https://watch.example/c" })));
    await expect(fetchWatch("movie:3")).resolves.toMatchObject({
      title: "Carrie",
      region: "US",
      attribution: "JustWatch",
      link: "https://watch.example/c",
      streaming: [],
    });
  });

  it("rejects an empty offer, server errors, bad JSON, and a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ title: "   " })));
    await expect(fetchWatch("movie:1")).rejects.toThrow("Watch lookup did not return providers.");

    vi.stubGlobal("fetch", vi.fn(async () => json({})));
    await expect(fetchWatch("movie:1")).rejects.toThrow("Watch lookup did not return providers.");

    vi.stubGlobal("fetch", vi.fn(async () => json(null)));
    await expect(fetchWatch("movie:1")).rejects.toThrow("Watch lookup did not return providers.");

    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Missing" }, 404)));
    await expect(fetchWatch("movie:9")).rejects.toThrow("Missing");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(fetchWatch("movie:9")).rejects.toThrow("Watch lookup failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(fetchWatch("movie:9")).rejects.toThrow("Watch lookup failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchWatch("movie:9")).rejects.toThrow("offline");
  });
});
