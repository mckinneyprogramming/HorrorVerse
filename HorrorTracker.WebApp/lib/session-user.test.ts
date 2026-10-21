import { afterEach, describe, expect, it, vi } from "vitest";
import { requireSessionUser } from "./neon";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requireSessionUser missing columns", () => {
  const url = "postgresql://user:secret@ep-test.neon.tech/HorrorVerse";

  it("uses blank email and display name when the session row omits them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rows: [{ id: 4, email: null, is_admin: true }] }), { status: 200 })),
    );
    const request = new Request("https://horrorverse.example/api/progress", { headers: { cookie: "hv_session=token" } });
    await expect(requireSessionUser(request, url)).resolves.toEqual({
      id: 4,
      email: "",
      displayName: "",
      isAdmin: true,
    });
  });
});
