import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentUser, loginAccount, logoutAccount, registerAccount, updateProfile } from "./auth";

const user = {
  id: 4,
  email: "riley@vault.test",
  displayName: "Riley",
  isAdmin: false,
  aboutMe: " Boo ",
  avatar: " pic ",
};

const trimmed = {
  id: 4,
  email: "riley@vault.test",
  displayName: "Riley",
  isAdmin: false,
  aboutMe: "Boo",
  avatar: "pic",
};

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
  vi.restoreAllMocks();
});

describe("fetchCurrentUser", () => {
  it("returns the signed-in profile", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ user })));
    await expect(fetchCurrentUser()).resolves.toEqual(trimmed);
  });

  it("keeps a profile that omits optional text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          user: { id: 1, email: "a@b.co", displayName: "Sam", isAdmin: true, aboutMe: "   ", avatar: "" },
        }),
      ),
    );
    await expect(fetchCurrentUser()).resolves.toEqual({
      id: 1,
      email: "a@b.co",
      displayName: "Sam",
      isAdmin: true,
    });
  });

  it("returns null when auth is refused, the body is junk, or the network fails", async () => {
    const payloads: unknown[] = [
      null,
      "nope",
      4,
      [],
      {},
      { user: null },
      { user: "riley" },
      { user: [] },
      { user: { id: "4", email: "a@b.co", displayName: "Riley", isAdmin: false } },
      { user: { id: 4, email: 4, displayName: "Riley", isAdmin: false } },
      { user: { id: 4, email: "a@b.co", displayName: 4, isAdmin: false } },
      { user: { id: 4, email: "a@b.co", displayName: "Riley", isAdmin: "no" } },
    ];

    for (const payload of payloads) {
      vi.stubGlobal("fetch", vi.fn(async () => json(payload)));
      await expect(fetchCurrentUser()).resolves.toBeNull();
    }

    vi.stubGlobal("fetch", vi.fn(async () => json({ user }, 401)));
    await expect(fetchCurrentUser()).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ user: { id: 4, email: "a@b.co", displayName: "Riley", isAdmin: false, aboutMe: 4, avatar: 4 } })),
    );
    await expect(fetchCurrentUser()).resolves.toEqual({
      id: 4,
      email: "a@b.co",
      displayName: "Riley",
      isAdmin: false,
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 200 })));
    await expect(fetchCurrentUser()).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });
});

describe("account mutations", () => {
  it("registers, signs in, and saves a profile", async () => {
    const fetchMock = vi.fn(async () => json({ user }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerAccount({ email: "riley@vault.test", password: "secret", displayName: "Riley" })).resolves.toEqual(
      trimmed,
    );
    await expect(loginAccount({ email: "riley@vault.test", password: "secret" })).resolves.toEqual(trimmed);
    await expect(updateProfile({ displayName: "Riley", aboutMe: "Boo", avatar: "pic" })).resolves.toEqual(trimmed);
    await expect(updateProfile({ avatar: null })).resolves.toEqual(trimmed);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "register", email: "riley@vault.test", password: "secret", displayName: "Riley" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/auth", expect.objectContaining({ method: "PATCH" }));
  });

  it("signs out with DELETE", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await logoutAccount();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth", { method: "DELETE" });
  });

  it("raises the server error, a status fallback, or a missing profile", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Email is taken" }, 409)));
    await expect(loginAccount({ email: "a@b.co", password: "x" })).rejects.toThrow("Email is taken");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(registerAccount({ email: "a@b.co", password: "x", displayName: "A" })).rejects.toThrow(
      "Account request failed (500)",
    );

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 400 })));
    await expect(updateProfile({ displayName: "A" })).rejects.toThrow("Account request failed (400)");

    vi.stubGlobal("fetch", vi.fn(async () => json({ user: null })));
    await expect(loginAccount({ email: "a@b.co", password: "x" })).rejects.toThrow("Could not sign in.");
    await expect(updateProfile({})).rejects.toThrow("Could not save the profile.");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(logoutAccount()).rejects.toThrow("offline");
    await expect(updateProfile({})).rejects.toThrow("offline");
    await expect(loginAccount({ email: "a@b.co", password: "x" })).rejects.toThrow("offline");
  });
});
