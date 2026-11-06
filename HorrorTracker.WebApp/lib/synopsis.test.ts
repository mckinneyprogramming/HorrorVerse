import { describe, expect, it } from "vitest";
import { jsonResponse, testConn, withNeonFetch } from "../test-helpers/http";
import { ensureSynopsis, ensureSynopsisColumns, storeSynopsis, synopsisText } from "./synopsis";

const CONN = testConn("synopsis");

describe("synopsisText", () => {
  it("keeps a synopsis and drops blank text", () => {
    expect(synopsisText("  A quiet street.  ")).toBe("A quiet street.");
    expect(synopsisText("   ")).toBeUndefined();
    expect(synopsisText(null)).toBeUndefined();
    const trimmed = synopsisText(`${"n".repeat(3999)}  ${"b".repeat(10)}`);
    expect(trimmed).toBe("n".repeat(3999));
  });
});

describe("ensureSynopsis", () => {
  it("returns a stored synopsis without calling TMDb", async () => {
    await withNeonFetch({ TMDBKey: "key" }, () => {
      throw new Error("TMDb should stay quiet");
    }, [{ match: "SELECT description", rows: [{ description: "Already saved.", tmdbid: 15 }] }], async () => {
      await expect(ensureSynopsis(CONN, "movie:4")).resolves.toBe("Already saved.");
    });
  });

  it("stores a TMDb overview when the movie has none", async () => {
    await withNeonFetch(
      { TMDBKey: "key" },
      (url) => (url.includes("/movie/15") ? jsonResponse({ overview: "Night in the woods." }) : jsonResponse({})),
      [
        { match: "SELECT description", rows: [{ description: null, tmdbid: 15 }] },
        { match: "UPDATE movie SET description", rows: [] },
      ],
      async (neon) => {
        await expect(ensureSynopsis(CONN, "movie:4")).resolves.toBe("Night in the woods.");
        expect(neon.calls.some((call) => call.query.includes("UPDATE movie SET description") && call.params[1] === "Night in the woods.")).toBe(
          true,
        );
      },
    );
  });

  it("stores an overview on import when the row is still blank", async () => {
    await withNeonFetch({}, () => jsonResponse({}), [], async (neon) => {
      await storeSynopsis(CONN, "movie", 4, "A mansion.");
      await storeSynopsis(CONN, "book", 4, "A mansion.");
      await storeSynopsis(CONN, "movie", 1.5, "A mansion.");
      await storeSynopsis(CONN, "movie", 0, "A mansion.");
      await storeSynopsis(CONN, "documentary", 4, "   ");
      expect(neon.calls.some((call) => call.query.includes("UPDATE movie") && call.params[1] === "A mansion.")).toBe(true);
      expect(neon.calls.some((call) => call.query.includes("UPDATE documentary"))).toBe(false);
    });
  });

  it("leaves a blank TMDb overview unsaved", async () => {
    await withNeonFetch(
      { TMDBKey: "key" },
      (url) => jsonResponse(url.includes("/tv/8") ? { overview: "   " } : { overview: "" }),
      [
        { match: "SELECT description", rows: [{ description: "  ", tmdbid: 8 }], once: true },
        { match: "SELECT description", rows: [{}], once: true },
      ],
      async (neon) => {
        await expect(ensureSynopsis(CONN, "show:4")).resolves.toBeUndefined();
        await expect(ensureSynopsis(CONN, "nope")).resolves.toBeUndefined();
        await expect(ensureSynopsis(CONN, "documentary:2")).resolves.toBeUndefined();
        expect(neon.calls.some((call) => call.query.includes("UPDATE"))).toBe(false);
      },
    );
  });

  it("adds the description columns and ignores a missing show table", async () => {
    await withNeonFetch(
      {},
      () => jsonResponse({}),
      [{ match: "ALTER TABLE show ADD COLUMN IF NOT EXISTS description", error: "relation show does not exist", once: true }],
      async () => {
        await ensureSynopsisColumns(CONN);
        await ensureSynopsisColumns(CONN);
      },
    );
  });
});
