import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpError,
  ensureUserLibrarySchema,
  execute,
  jsonError,
  queryRows,
  readSessionToken,
  requireDatabaseUrl,
  requireSessionUser,
  resolveDatabaseUrl,
} from "./neon";

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  HorrorVerseDb: process.env.HorrorVerseDb,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
};

afterEach(() => {
  restore("DATABASE_URL", originalEnv.DATABASE_URL);
  restore("HorrorVerseDb", originalEnv.HorrorVerseDb);
  restore("ADMIN_EMAIL", originalEnv.ADMIN_EMAIL);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function restore(name: "DATABASE_URL" | "HorrorVerseDb" | "ADMIN_EMAIL", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function silenceConsole() {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("readSessionToken", () => {
  it("reads the HorrorVerse session cookie", () => {
    const request = new Request("https://horrorverse.vercel.app/api/lists", {
      headers: { cookie: "other=1; hv_session=abc%20123; extra=2" },
    });
    expect(readSessionToken(request)).toBe("abc 123");
  });

  it("returns undefined when the session cookie is missing or unnamed", () => {
    expect(readSessionToken(new Request("https://horrorverse.vercel.app/api/lists"))).toBeUndefined();
    const request = new Request("https://horrorverse.vercel.app/api/lists", {
      headers: { cookie: "orphan; other=1" },
    });
    expect(readSessionToken(request)).toBeUndefined();
  });
});

describe("jsonError", () => {
  it("returns the status from an HttpError", async () => {
    silenceConsole();
    const response = jsonError(new HttpError("Sign in to continue.", 401), {
      log: "test",
      fallback: "failed",
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });

  it("returns 503 when the database is not configured", async () => {
    silenceConsole();
    const response = jsonError(new Error("DATABASE_URL is not configured."), {
      log: "test",
      fallback: "failed",
      unavailable: "Database offline.",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Database offline." });
  });

  it("uses the fallback when an unknown failure has no unavailable copy", async () => {
    silenceConsole();
    const configured = jsonError(new Error("DATABASE_URL is not configured."), { log: "test", fallback: "failed" });
    const unknown = jsonError("boom", { log: "test", fallback: "failed" });
    expect(configured.status).toBe(503);
    expect(unknown.status).toBe(500);
    await expect(configured.json()).resolves.toEqual({ error: "failed" });
    await expect(unknown.json()).resolves.toEqual({ error: "failed" });
  });
});

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL and strips the pooler host", () => {
    process.env.DATABASE_URL = "postgres://user:secret@ep-test-pooler.neon.tech/HorrorVerse?channel_binding=require";
    delete process.env.HorrorVerseDb;
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://user:secret@ep-test.neon.tech/HorrorVerse?sslmode=require",
    );
  });

  it("converts a postgres URI in HorrorVerseDb", () => {
    delete process.env.DATABASE_URL;
    process.env.HorrorVerseDb = "postgresql://user:secret@localhost/HorrorVerse";
    expect(resolveDatabaseUrl()).toContain("postgresql://user:secret@localhost/HorrorVerse");
  });

  it("converts an Npgsql connection string", () => {
    delete process.env.DATABASE_URL;
    process.env.HorrorVerseDb = "Host=db.example;User=reader;Password=secret";
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://reader:secret@db.example/HorrorTracker?sslmode=require",
    );
  });

  it("returns undefined when neither setting is present", () => {
    delete process.env.DATABASE_URL;
    delete process.env.HorrorVerseDb;
    expect(resolveDatabaseUrl()).toBeUndefined();
    expect(() => requireDatabaseUrl()).toThrow(HttpError);
  });

  it("rejects an Npgsql string without a host or user", () => {
    delete process.env.DATABASE_URL;
    process.env.HorrorVerseDb = "Password=secret;Database=HorrorTracker";
    expect(() => resolveDatabaseUrl()).toThrow(/Host or Username/);
  });

  it("ignores blank pieces in an Npgsql string", () => {
    delete process.env.DATABASE_URL;
    process.env.HorrorVerseDb = "; =bad;Host=db.example;Username=reader";
    expect(resolveDatabaseUrl()).toBe("postgresql://reader@db.example/HorrorTracker?sslmode=require");
    expect(requireDatabaseUrl()).toContain("db.example");
  });
});

describe("neon HTTP", () => {
  it("returns rows and executes statements", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rows: [{ id: 1 }] }), { status: 200 })),
    );
    await expect(queryRows("postgresql://user:secret@ep-test.neon.tech/HorrorVerse", "SELECT 1")).resolves.toEqual([
      { id: 1 },
    ]);
    await expect(execute("postgresql://user:secret@ep-test.neon.tech/HorrorVerse", "SELECT 1", [1])).resolves.toBeUndefined();
  });

  it("rejects a payload without rows and a failed response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "bad sql" }), { status: 400 }))
      .mockResolvedValueOnce(new Response("nope", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const url = "postgresql://user:secret@ep-test.neon.tech/HorrorVerse";
    await expect(queryRows(url, "SELECT 1")).rejects.toThrow(/did not include rows/);
    await expect(execute(url, "SELECT 1")).rejects.toThrow("bad sql");
    await expect(execute(url, "SELECT 1")).rejects.toThrow("Neon HTTP 502");
  });
});

describe("requireSessionUser", () => {
  const url = "postgresql://user:secret@ep-test.neon.tech/HorrorVerse";

  it("requires a session cookie", async () => {
    await expect(requireSessionUser(new Request("https://horrorverse.example/api/progress"), url)).rejects.toThrow(
      /Sign in/,
    );
  });

  it("rejects an unknown or broken session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rows: [] }), { status: 200 })));
    const request = new Request("https://horrorverse.example/api/progress", { headers: { cookie: "hv_session=gone" } });
    await expect(requireSessionUser(request, url)).rejects.toThrow(/Sign in/);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rows: [{ id: 0, email: "a@b.c" }] }), { status: 200 })),
    );
    await expect(requireSessionUser(request, url)).rejects.toThrow(/Sign in/);
  });

  it("marks the configured admin email", async () => {
    process.env.ADMIN_EMAIL = "Ash@Example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ rows: [{ id: 4, email: "ash@example.com", displayName: "Ash", isAdmin: false }] }),
          { status: 200 },
        ),
      ),
    );
    const request = new Request("https://horrorverse.example/api/progress", { headers: { cookie: "hv_session=token" } });
    await expect(requireSessionUser(request, url)).resolves.toEqual({
      id: 4,
      email: "ash@example.com",
      displayName: "Ash",
      isAdmin: true,
    });
  });
});

describe("ensureUserLibrarySchema", () => {
  it("creates the library tables and ignores an expression-index rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { query: string };
        if (body.query.includes("user_list_user_name_idx")) {
          return new Response(JSON.stringify({ message: "rejected" }), { status: 400 });
        }

        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      }),
    );
    await expect(ensureUserLibrarySchema("postgresql://user:secret@ep-test.neon.tech/HorrorVerse")).resolves.toBeUndefined();
  });
});
