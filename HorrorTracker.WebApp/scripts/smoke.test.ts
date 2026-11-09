import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runIfDirect, runSmoke, smokeJunit } from "./smoke.mjs";

function response(body: unknown, status = 200): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status });
}

function fetchRoutes(routes: Record<string, Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    const match = routes[path];
    if (!match) {
      throw new Error(`missing ${path}`);
    }
    return match;
  }) as typeof fetch;
}

describe("deploy smoke", () => {
  const previous = process.env.SMOKE_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.SMOKE_URL;
    } else {
      process.env.SMOKE_URL = previous;
    }
    vi.restoreAllMocks();
  });

  it("skips when no deploy url is configured", async () => {
    const lines: string[] = [];
    await expect(runSmoke({}, fetch, { log: (line: string) => lines.push(line), error: () => undefined })).resolves.toBe(0);
    expect(lines).toEqual(["SMOKE_URL is not set; skipping the deploy smoke check."]);
  });

  it("accepts a healthy unsigned deploy and records each failed check", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const logger = { log: (line: string) => logs.push(line), error: (line: string) => errors.push(line) };
    const passing = fetchRoutes({
      "/api/health": response({ status: "ok" }),
      "/api/catalog": response({ movies: [] }),
      "/api/auth": response({ user: null }),
      "/api/progress": response({ error: "Sign in" }, 401),
    });
    await expect(runSmoke({ SMOKE_URL: "https://horror.example/" }, passing, logger)).resolves.toBe(0);
    expect(logs).toEqual(["ok /api/health", "ok /api/catalog", "ok /api/auth", "ok /api/progress"]);

    const failing = fetchRoutes({
      "/api/health": response({}, 500),
      "/api/catalog": response(4),
      "/api/auth": response({ user: { id: 1 } }),
      "/api/progress": response("not-json", 200),
    });
    await expect(runSmoke({ SMOKE_URL: "https://horror.example" }, failing, logger)).resolves.toBe(1);
    expect(errors.map((line) => line.slice(0, 24))).toEqual([
      "FAIL /api/health status=",
      "FAIL /api/catalog status",
      "FAIL /api/auth status=20",
      "FAIL /api/progress statu",
    ]);
    const missingCatalog = fetchRoutes({
      "/api/health": response({ status: "ok" }),
      "/api/catalog": response(null),
      "/api/auth": response({ user: null }),
      "/api/progress": response({}, 401),
    });
    await expect(runSmoke({ SMOKE_URL: "https://horror.example" }, missingCatalog, logger)).resolves.toBe(1);
    expect(errors.at(-1)?.startsWith("FAIL /api/catalog status=200")).toBe(true);
  });

  it("writes a junit report for passed, failed, and skipped checks", async () => {
    const xml = smokeJunit([
      { name: "/api/health" },
      { name: "/api/catalog", failed: true, message: 'status=500 body=<bad & "no">' },
      { name: "live deploy", skipped: true },
    ]);
    expect(xml).toContain('tests="3" failures="1" skipped="1"');
    expect(xml).toContain('<testcase classname="deploy-smoke" name="/api/health"/>');
    expect(xml).toContain('message="status=500 body=&lt;bad &amp; &quot;no&quot;&gt;"');
    expect(xml).toContain('<testcase classname="deploy-smoke" name="live deploy"><skipped/></testcase>');

    const dir = await mkdtemp(path.join(tmpdir(), "horror-smoke-"));
    const report = path.join(dir, "nested", "smoke.xml");
    const logger = { log: () => undefined, error: () => undefined };
    try {
      await expect(runSmoke({ SMOKE_JUNIT: report }, fetch, logger)).resolves.toBe(0);
      expect(await readFile(report, "utf8")).toContain('name="live deploy"><skipped/></testcase>');

      const passing = fetchRoutes({
        "/api/health": response({ status: "ok" }),
        "/api/catalog": response({ movies: [] }),
        "/api/auth": response({ user: null }),
        "/api/progress": response({ error: "Sign in" }, 401),
      });
      await expect(runSmoke({ SMOKE_URL: "https://horror.example/", SMOKE_JUNIT: report }, passing, logger)).resolves.toBe(0);
      const passed = await readFile(report, "utf8");
      expect(passed).toContain('tests="4" failures="0" skipped="0"');
      expect(passed).toContain('name="/api/progress"/>');

      const failing = fetchRoutes({
        "/api/health": response('<bad & "no">', 500),
        "/api/catalog": response({ movies: [] }),
        "/api/auth": response({ user: null }),
        "/api/progress": response({}, 401),
      });
      await expect(runSmoke({ SMOKE_URL: "https://horror.example", SMOKE_JUNIT: report }, failing, logger)).resolves.toBe(1);
      expect(await readFile(report, "utf8")).toContain('failures="1"');
      expect(await readFile(report, "utf8")).toContain("&lt;bad &amp; &quot;no&quot;&gt;");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exits from the direct entry point", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as typeof process.exit);
    const scriptPath = fileURLToPath(new URL("./smoke.mjs", import.meta.url));
    await runIfDirect("file:///somewhere-else.mjs", ["node"]);
    await expect(runIfDirect(pathToFileURL(scriptPath).href, ["node", scriptPath], {})).rejects.toThrow("exit 0");
    expect(exit).toHaveBeenCalledWith(0);
    await expect(
      runIfDirect(pathToFileURL(scriptPath).href, ["node", scriptPath], { SMOKE_URL: "https://horror.example" }, fetchRoutes({
        "/api/health": response({ status: "down" }, 503),
        "/api/catalog": response([]),
        "/api/auth": response({ user: null }),
        "/api/progress": response({}, 401),
      })),
    ).rejects.toThrow("exit 1");
  });
});
