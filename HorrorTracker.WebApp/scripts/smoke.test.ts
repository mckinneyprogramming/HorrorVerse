import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runIfDirect, runSmoke } from "./smoke.mjs";

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
