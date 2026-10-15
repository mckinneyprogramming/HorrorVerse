import { describe, expect, it } from "vitest";
import { canMarkEarlier } from "./progress";

describe("canMarkEarlier", () => {
  it("is available until a title is finished without a date", () => {
    expect(canMarkEarlier([], "show:1")).toBe(true);
    expect(canMarkEarlier(["movie:2"], "show:1")).toBe(true);
    expect(canMarkEarlier(["show:1"], "show:1")).toBe(false);
  });
});
