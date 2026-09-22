import { describe, expect, it } from "vitest";
import { normalizeVisibility } from "./lists";

describe("normalizeVisibility", () => {
  it("keeps public lists public", () => {
    expect(normalizeVisibility("public")).toBe("public");
    expect(normalizeVisibility("PUBLIC")).toBe("public");
  });

  it("treats anything else as private", () => {
    expect(normalizeVisibility("private")).toBe("private");
    expect(normalizeVisibility("Publicish")).toBe("private");
    expect(normalizeVisibility("")).toBe("private");
    expect(normalizeVisibility(undefined)).toBe("private");
    expect(normalizeVisibility(null)).toBe("private");
  });
});
