import { describe, expect, it } from "vitest";
import { HttpError } from "./neon";
import { parseCatalogId } from "./catalog-id";

describe("parseCatalogId", () => {
  it("splits a catalog id", () => {
    expect(parseCatalogId("show:9")).toEqual({ kind: "show", mediaId: 9 });
  });

  it("rejects invalid ids", () => {
    expect(() => parseCatalogId("show")).toThrowError(new HttpError("That title was not found.", 400));
    expect(() => parseCatalogId("book:0")).toThrow(HttpError);
    expect(() => parseCatalogId("alien:1")).toThrow(HttpError);
    expect(() => parseCatalogId(null)).toThrow(HttpError);
    expect(() => parseCatalogId(undefined)).toThrow(HttpError);
    expect(() => parseCatalogId("movie:1:2")).toThrow(HttpError);
    expect(() => parseCatalogId("movie:1.5")).toThrow(HttpError);
    expect(() => parseCatalogId("movie:-3")).toThrow(HttpError);
  });

  it("trims and lowercases the kind", () => {
    expect(parseCatalogId(" Show :4 ")).toEqual({ kind: "show", mediaId: 4 });
  });

  it("can return a custom status", () => {
    try {
      parseCatalogId("movie:1", ["show"], "That title was not found.", 404);
      throw new Error("expected parseCatalogId to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(404);
    }
  });
});
