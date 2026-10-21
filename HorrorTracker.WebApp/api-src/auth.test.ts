import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, hashPassword } from "./auth";
import { installApi, jsonCall, readBody, sessionStep, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

const userRow = {
  id: 4,
  email: "member@example.com",
  display_name: "Member",
  is_admin: false,
  about_me: "  Likes fog  ",
  avatar: " data:image/png;base64,abc ",
};

describe("auth session", () => {
  it("returns null when the request is unsigned and clears a cookie on logout", async () => {
    handle = installApi();
    const guest = await readBody(await GET(new Request("http://localhost/api/auth")));
    expect(guest).toEqual({ user: null });

    const loggedOut = await DELETE(new Request("http://localhost/api/auth", { method: "DELETE" }));
    expect(await readBody(loggedOut)).toEqual({ user: null });
    expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(loggedOut.headers.get("set-cookie")).not.toContain("Secure");
    expect(handle.calls.some((call) => call.query.includes("DELETE FROM app_session"))).toBe(false);
  });

  it("returns the signed-in profile and deletes the session token", async () => {
    handle = installApi([sessionStep(userRow)]);
    const response = await GET(
      new Request("https://localhost/api/auth", { headers: { cookie: "hv_session=session-token" } }),
    );
    expect(await readBody(response)).toEqual({
      user: {
        id: 4,
        email: "member@example.com",
        displayName: "Member",
        isAdmin: false,
        aboutMe: "Likes fog",
        avatar: "data:image/png;base64,abc",
      },
    });

    const loggedOut = await DELETE(
      new Request("http://localhost/api/auth", {
        method: "DELETE",
        headers: { cookie: "hv_session=session-token", "x-forwarded-proto": "https,http" },
      }),
    );
    expect(loggedOut.headers.get("set-cookie")).toContain("Secure");
    expect(handle.calls.some((call) => call.query.includes("DELETE FROM app_session"))).toBe(true);
  });

  it("promotes and demotes admin from ADMIN_EMAIL while reading the session", async () => {
    handle = installApi([
      sessionStep({ ...userRow, is_admin: false, aboutMe: "From camel", displayName: "Camel" }),
    ]);
    process.env.ADMIN_EMAIL = " Member@Example.com ";
    const promoted = await readBody(
      await GET(new Request("http://localhost/api/auth", { headers: { cookie: "hv_session=session-token", "x-forwarded-proto": "http" } })),
    );
    expect((promoted.user as { isAdmin: boolean }).isAdmin).toBe(true);
    expect(handle.calls.some((call) => call.query.includes("SET is_admin"))).toBe(true);

    handle.restore();
    handle = installApi([sessionStep({ ...userRow, is_admin: true })]);
    process.env.ADMIN_EMAIL = "member@example.com";
    await GET(new Request("http://localhost/api/auth", { headers: { cookie: "hv_session=session-token" } }));
    expect(handle.calls.some((call) => call.query.includes("SET is_admin"))).toBe(false);

    handle.restore();
    handle = installApi([sessionStep({ ...userRow, is_admin: true })]);
    delete process.env.ADMIN_EMAIL;
    await GET(new Request("http://localhost/api/auth", { headers: { cookie: "hv_session=session-token" } }));
    expect(handle.calls.some((call) => call.query.includes("SET is_admin"))).toBe(true);
  });

  it("returns the neon and configuration failures", async () => {
    handle = installApi([{ match: "CREATE TABLE IF NOT EXISTS app_user", error: "db down" }]);
    const failed = await GET(new Request("http://localhost/api/auth"));
    expect(failed.status).toBe(500);
    expect(await readBody(failed)).toEqual({ error: "Account unavailable." });

    handle.restore();
    handle = installApi();
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    const missing = await GET(new Request("http://localhost/api/auth"));
    expect(missing.status).toBe(503);
  });
});

describe("auth login and register", () => {
  it("logs in with a matching password and sets a secure cookie on Vercel", async () => {
    const passwordHash = await hashPassword("vault-key");
    handle = installApi([
      {
        match: "password_hash FROM app_user",
        rows: [{ ...userRow, password_hash: passwordHash, is_admin: false }],
      },
    ]);
    process.env.ADMIN_EMAIL = "other@example.com";
    process.env.VERCEL = "1";
    const response = await POST(
      jsonCall("http://localhost/api/auth", "POST", { email: " Member@Example.com ", password: "vault-key" }, null),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=");
    const body = await readBody(response);
    expect((body.user as { email: string }).email).toBe("member@example.com");
  });

  it("rejects a missing user, a bad password, and a hashless row", async () => {
    handle = installApi([{ match: "password_hash FROM app_user", rows: [] }]);
    const missing = await POST(jsonCall("http://localhost/api/auth", "POST", { action: " LOGIN ", email: "member@example.com", password: "vault-key" }, null));
    expect(missing.status).toBe(401);

    handle.restore();
    handle = installApi([
      { match: "password_hash FROM app_user", rows: [{ ...userRow, password_hash: "pbkdf2$sha256$1$YQ==$YQ==" }] },
    ]);
    const wrong = await POST(jsonCall("http://localhost/api/auth", "POST", { email: "member@example.com", password: "vault-key" }, null));
    expect(wrong.status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "password_hash FROM app_user", rows: [{ ...userRow }] }]);
    const hashless = await POST(jsonCall("http://localhost/api/auth", "POST", { email: "member@example.com", password: "vault-key" }, null));
    expect(hashless.status).toBe(401);
  });

  it("registers an account, derives a display name, and flags the admin email", async () => {
    handle = installApi([{ match: "INSERT INTO app_user", rows: [{ ...userRow, is_admin: true, display_name: "member" }] }]);
    process.env.ADMIN_EMAIL = "member@example.com";
    const response = await POST(
      jsonCall(
        "http://localhost/api/auth",
        "POST",
        { action: " Register ", email: "member@example.com", password: "vault-key", displayName: ` ${"N".repeat(90)} ` },
        null,
      ),
    );
    expect(response.status).toBe(200);
    const insert = handle.calls.find((call) => call.query.includes("INSERT INTO app_user"));
    expect(insert?.params[1]).toHaveLength(80);
    expect(insert?.params[3]).toBe(true);

    handle.restore();
    handle = installApi([{ match: "INSERT INTO app_user", rows: [userRow] }]);
    delete process.env.ADMIN_EMAIL;
    const named = await POST(
      jsonCall("http://localhost/api/auth", "POST", { action: "register", email: "fan@example.com", password: "vault-key" }, null),
    );
    expect(named.status).toBe(200);
    const derived = handle.calls.find((call) => call.query.includes("INSERT INTO app_user"));
    expect(derived?.params[1]).toBe("fan");
    expect(derived?.params[3]).toBe(false);
  });

  it("rejects invalid credentials, duplicates, empty inserts, and other database errors", async () => {
    handle = installApi();
    const cases: { body: Record<string, unknown>; status: number }[] = [
      { body: { action: "register", email: "a", password: "vault-key" }, status: 400 },
      { body: { action: "register", email: `${"a".repeat(250)}@example.com`, password: "vault-key" }, status: 400 },
      { body: { action: "register", email: "abcd", password: "vault-key" }, status: 400 },
      { body: { action: "register", email: "ab@cd", password: "vault-key" }, status: 400 },
      { body: { action: "register", email: "not-an-email", password: "short" }, status: 400 },
      { body: { action: "register", email: "a@b.c", password: "short" }, status: 400 },
      { body: { action: "register", email: "a@b.c", password: "p".repeat(257) }, status: 400 },
      { body: { action: "login" }, status: 400 },
    ];
    for (const entry of cases) {
      const response = await POST(jsonCall("http://localhost/api/auth", "POST", entry.body, null));
      expect(response.status).toBe(entry.status);
    }

    const invalid = await POST(
      new Request("http://localhost/api/auth", { method: "POST", body: "not-json", headers: { "content-type": "application/json" } }),
    );
    expect(invalid.status).toBe(400);

    handle.restore();
    handle = installApi();
    const emptyInsert = await POST(
      jsonCall("http://localhost/api/auth", "POST", { action: "register", email: "member@example.com", password: "vault-key", displayName: "Member" }, null),
    );
    expect(emptyInsert.status).toBe(500);
    expect(await readBody(emptyInsert)).toEqual({ error: "Could not create the account." });

    handle.restore();
    handle = installApi([{ match: "INSERT INTO app_user", error: "duplicate key value violates unique constraint" }]);
    const duplicate = await POST(
      jsonCall("http://localhost/api/auth", "POST", { action: "register", email: "member@example.com", password: "vault-key" }, null),
    );
    expect(duplicate.status).toBe(409);

    handle.restore();
    handle = installApi([{ match: "INSERT INTO app_user", error: "unique violation" }]);
    const unique = await POST(
      jsonCall("http://localhost/api/auth", "POST", { action: "register", email: "member@example.com", password: "vault-key" }, null),
    );
    expect(unique.status).toBe(409);

    handle.restore();
    handle = installApi([{ match: "INSERT INTO app_user", error: "syntax error" }]);
    const other = await POST(
      jsonCall("http://localhost/api/auth", "POST", { action: "register", email: "member@example.com", password: "vault-key" }, null),
    );
    expect(other.status).toBe(500);
    expect(await readBody(other)).toEqual({ error: "Account unavailable." });
  });
});

describe("auth profile", () => {
  it("requires a session and saves the supplied profile fields", async () => {
    handle = installApi();
    const unsigned = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { displayName: "Hex" }, null));
    expect(unsigned.status).toBe(401);

    handle.restore();
    handle = installApi([{ match: "FROM app_session", rows: [] }]);
    const wrong = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { displayName: "Hex" }));
    expect(wrong.status).toBe(401);

    const jpeg = `data:image/jpeg;base64,${"a".repeat(20)}`;
    const png = "data:image/png;base64,ccc";
    const webp = "data:image/webp;base64,ddd";
    handle.restore();
    handle = installApi([
      sessionStep({ ...userRow, about_me: null, avatar: null }),
      { match: "UPDATE app_user", rows: [{ id: 4, email: "member@example.com", display_name: "Hex", is_admin: false, about_me: "Bio", avatar: jpeg }] },
    ]);
    const saved = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { displayName: " Hex ", aboutMe: " Bio ", avatar: jpeg }));
    expect(saved.status).toBe(200);

    handle.restore();
    handle = installApi([
      sessionStep(userRow),
      { match: "UPDATE app_user", rows: [{ id: 4, email: "member@example.com", displayName: "Kept", isAdmin: true }] },
    ]);
    const kept = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", {}));
    expect(kept.status).toBe(200);
    const keptBody = await readBody(kept);
    expect(keptBody.user).toMatchObject({ displayName: "Kept", isAdmin: true });

    handle.restore();
    handle = installApi([
      sessionStep({ id: 4, email: "fan@example.com", display_name: "Fan", is_admin: false, about_me: "Stay" }),
      { match: "UPDATE app_user", rows: [{ id: 4, email: "fan@example.com", display_name: "fan", is_admin: false }] },
    ]);
    const cleared = await PATCH(
      jsonCall("http://localhost/api/auth", "PATCH", { displayName: "   ", aboutMe: "   ", avatar: "   " }),
    );
    expect(cleared.status).toBe(200);
    const update = handle.calls.find((call) => call.query.includes("UPDATE app_user"));
    expect(update?.params[0]).toBe("fan");
    expect(update?.params[1]).toBeNull();
    expect(update?.params[2]).toBeNull();

    handle.restore();
    handle = installApi([
      sessionStep(userRow),
      { match: "UPDATE app_user", rows: [{ id: 4, email: "member@example.com", display_name: "Member", is_admin: false, avatar: png }] },
    ]);
    const pngSaved = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { avatar: png, aboutMe: "x".repeat(600) }));
    expect(pngSaved.status).toBe(200);
    const longAbout = handle.calls.find((call) => call.query.includes("UPDATE app_user"));
    expect(longAbout?.params[1]).toHaveLength(500);

    handle.restore();
    handle = installApi([
      sessionStep(userRow),
      { match: "UPDATE app_user", rows: [{ id: 4, email: "member@example.com", display_name: "Member", is_admin: false, avatar: webp }] },
    ]);
    expect((await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { avatar: webp }))).status).toBe(200);
  });

  it("rejects a bad photo, a missing update, invalid JSON, and a database error", async () => {
    handle = installApi([sessionStep(userRow)]);
    const huge = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { avatar: `data:image/png;base64,${"a".repeat(120_001)}` }));
    expect(huge.status).toBe(400);
    expect(await readBody(huge)).toEqual({ error: "Choose a smaller profile photo." });

    const kind = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { avatar: "data:image/gif;base64,abc" }));
    expect(kind.status).toBe(400);

    handle.restore();
    handle = installApi([sessionStep(userRow), { match: "UPDATE app_user", rows: [] }]);
    const missing = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { displayName: "Hex" }));
    expect(missing.status).toBe(500);
    expect(await readBody(missing)).toEqual({ error: "Could not save the profile." });

    handle.restore();
    handle = installApi([
      sessionStep(userRow),
      { match: "UPDATE app_user", rows: [{ id: 4, email: "member@example.com", display_name: "Member", is_admin: false }] },
    ]);
    const invalid = await PATCH(
      new Request("http://localhost/api/auth", {
        method: "PATCH",
        headers: { cookie: "hv_session=session-token", "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(invalid.status).toBe(200);

    handle.restore();
    handle = installApi([sessionStep(userRow), { match: "UPDATE app_user", error: "db down" }]);
    const failed = await PATCH(jsonCall("http://localhost/api/auth", "PATCH", { displayName: "Hex" }));
    expect(failed.status).toBe(500);
  });
});
