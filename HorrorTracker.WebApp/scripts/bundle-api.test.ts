import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bundleApi, runIfDirect, sameBundle } from "./bundle-api.mjs";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function workspace(): Promise<{ srcDir: string; outDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "horror-bundle-"));
  temps.push(root);
  const srcDir = join(root, "api-src");
  const outDir = join(root, "api");
  await mkdir(srcDir);
  return { srcDir, outDir };
}

function built(text: string | undefined) {
  return async () => ({ outputFiles: text === undefined ? [] : [{ text }] });
}

describe("api bundling", () => {
  it("treats CRLF as the same bundle", () => {
    expect(sameBundle("bundled\r\n", "bundled\n")).toBe(true);
    expect(sameBundle("old\n", "new\n")).toBe(false);
  });

  it("writes fresh bundles, skips tests, and removes leftovers", async () => {
    const { srcDir, outDir } = await workspace();
    await writeFile(join(srcDir, "zeta.ts"), "export const zeta = 1\n");
    await writeFile(join(srcDir, "alpha.ts"), "export const alpha = 1\n");
    await writeFile(join(srcDir, "alpha.test.ts"), "export {}\n");
    await writeFile(join(srcDir, "notes.txt"), "skip\n");
    await mkdir(outDir);
    await writeFile(join(outDir, "old.ts"), "leftover");
    await writeFile(join(outDir, "old.test.js"), "leftover");
    const seen: string[] = [];
    const lines: string[] = [];
    await bundleApi({
      srcDir,
      outDir,
      buildImpl: async (options) => {
        seen.push(String(options.entryPoints?.[0]));
        return { outputFiles: [{ text: `bundled ${options.entryPoints?.[0]}\n` }] };
      },
      log: (line) => lines.push(line),
    });

    expect(seen.map((entry) => entry.endsWith("alpha.ts"))).toEqual([true, false]);
    expect(await readFile(join(outDir, "alpha.js"), "utf8")).toContain("bundled");
    await expect(readFile(join(outDir, "old.ts"), "utf8")).rejects.toThrow();
    await expect(readFile(join(outDir, "alpha.test.js"), "utf8")).rejects.toThrow();
    expect(lines).toEqual(["Bundled 2 Vercel functions into api/."]);

    await bundleApi({
      srcDir,
      outDir,
      check: true,
      buildImpl: async (options) => ({ outputFiles: [{ text: `bundled ${options.entryPoints?.[0]}\n` }] }),
      log: () => {
        throw new Error("check should stay quiet");
      },
    });
  });

  it("reports a stale check without writing and accepts a missing file as empty", async () => {
    const { srcDir, outDir } = await workspace();
    await writeFile(join(srcDir, "health.ts"), "export {}\n");
    await expect(bundleApi({ srcDir, outDir, check: true, buildImpl: built("next\n"), log: () => undefined })).rejects.toThrow(
      "health.js is stale",
    );
    await expect(readFile(join(outDir, "health.js"), "utf8")).rejects.toThrow();

    await writeFile(join(outDir, "health.js"), "next\r\n");
    await bundleApi({ srcDir, outDir, check: true, buildImpl: built("next\n") });
    await writeFile(join(outDir, "stray.test.js"), "nope");
    await expect(bundleApi({ srcDir, outDir, check: true, buildImpl: built("next\n") })).rejects.toThrow(
      "stray.test.js should not be deployed",
    );
  });

  it("rejects an empty source directory and an empty esbuild result", async () => {
    const { srcDir, outDir } = await workspace();
    await expect(bundleApi({ srcDir, outDir, buildImpl: built("unused") })).rejects.toThrow("No api-src/*.ts files to bundle.");
    await writeFile(join(srcDir, "health.ts"), "export {}\n");
    await expect(bundleApi({ srcDir, outDir, buildImpl: built(undefined) })).rejects.toThrow(
      "esbuild produced no output for health.ts.",
    );
    await expect(bundleApi({ srcDir, outDir, buildImpl: built("") })).rejects.toThrow("esbuild produced no output for health.ts.");
  });

  it("checks the real api directory when the script is the entry point", async () => {
    const scriptPath = fileURLToPath(new URL("./bundle-api.mjs", import.meta.url));
    await runIfDirect("file:///somewhere-else.mjs", ["node"]);
    await runIfDirect(pathToFileURL(scriptPath).href, ["node", scriptPath, "--check"]);
  });
});
