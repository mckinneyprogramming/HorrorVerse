import { describe, expect, it } from "vitest";
import { HttpError, jsonError, readSessionToken } from "./neon";

describe("readSessionToken", () => {
  it("reads the HorrorVerse session cookie", () => {
    const request = new Request("https://horrorverse.vercel.app/api/lists", {
      headers: { cookie: "other=1; hv_session=abc%20123; extra=2" },
    });
    expect(readSessionToken(request)).toBe("abc 123");
  });

  it("returns undefined when the session cookie is missing", () => {
    const request = new Request("https://horrorverse.vercel.app/api/lists");
    expect(readSessionToken(request)).toBeUndefined();
  });
});

describe("jsonError", () => {
  it("returns the status from an HttpError", async () => {
    const error = console.error;
    console.error = () => undefined;
    const response = jsonError(new HttpError("Sign in to continue.", 401), {
      log: "test",
      fallback: "failed",
    });
    console.error = error;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });
});
