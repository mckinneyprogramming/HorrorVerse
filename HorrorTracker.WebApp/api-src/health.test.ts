import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./health";
import { installApi, type ApiHandle } from "../test-helpers/api";

let handle: ApiHandle | undefined;

afterEach(() => {
  handle?.restore();
  handle = undefined;
});

describe("health", () => {
  it("reports a configured database from DATABASE_URL", async () => {
    handle = installApi();
    const body = await (await GET()).json();
    expect(body).toEqual({ status: "ok", databaseConfigured: true });
  });

  it("reports a configured database from HorrorVerseDb when DATABASE_URL is blank", async () => {
    handle = installApi();
    process.env.DATABASE_URL = "   ";
    process.env.HorrorVerseDb = "Host=db.example";
    const body = await (await GET()).json();
    expect(body).toEqual({ status: "ok", databaseConfigured: true });
  });

  it("reports an unconfigured database when both env vars are blank", async () => {
    handle = installApi();
    delete process.env.DATABASE_URL;
    process.env.HorrorVerseDb = "  ";
    const blank = await (await GET()).json();
    expect(blank).toEqual({ status: "ok", databaseConfigured: false });

    delete process.env.HorrorVerseDb;
    const missing = await (await GET()).json();
    expect(missing).toEqual({ status: "ok", databaseConfigured: false });
  });
});
