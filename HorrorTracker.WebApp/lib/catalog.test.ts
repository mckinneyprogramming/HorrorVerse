import { describe, expect, it } from "vitest";
import { filmsFromCollection } from "./catalog";

describe("filmsFromCollection", () => {
  it("returns no films when the collection has no dated parts", async () => {
    await expect(filmsFromCollection({})).resolves.toEqual([]);
    await expect(filmsFromCollection({ parts: ["skip", { id: 1 }] })).resolves.toEqual([]);
  });
});
