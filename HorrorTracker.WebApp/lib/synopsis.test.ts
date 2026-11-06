import { describe, expect, it } from "vitest";
import { jsonResponse, testConn, withNeonFetch } from "../test-helpers/http";
import { ensureSynopsis, storeSynopsis, synopsisText } from "./synopsis";

const CONN = testConn("synopsis");

describe("synopsisText", () => {
  it("keeps a synopsis and drops blank text", () => {
    expect(synopsisText("  A quiet street.  ")).toBe("A quiet street.");
    expect(synopsisText("   ")).toBeUndefined();
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
      expect(neon.calls.some((call) => call.query.includes("UPDATE movie") && call.params[1] === "A mansion.")).toBe(true);
    });
  });
});
