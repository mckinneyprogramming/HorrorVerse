import { build } from "esbuild";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const webAppDir = dirname(rootDir);
const srcDir = join(webAppDir, "api-src");
const outDir = join(webAppDir, "api");
const check = process.argv.includes("--check");
const banner = "/* Generated from api-src. Edit api-src and lib, then run npm run bundle-api. */\n";

const entries = (await readdir(srcDir)).filter((name) => name.endsWith(".ts")).sort();
if (entries.length === 0) {
  throw new Error("No api-src/*.ts files to bundle.");
}

await mkdir(outDir, { recursive: true });

const stale = [];
for (const name of entries) {
  const result = await build({
    absWorkingDir: webAppDir,
    entryPoints: [join(srcDir, name)],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    legalComments: "none",
    banner: { js: banner },
    logLevel: "silent",
    write: false,
  });
  const next = result.outputFiles[0]?.text;
  if (!next) {
    throw new Error(`esbuild produced no output for ${name}.`);
  }

  const outfile = join(outDir, name.replace(/\.ts$/, ".js"));
  const current = await readFile(outfile, "utf8").catch(() => "");
  if (current !== next) {
    stale.push(name.replace(/\.ts$/, ".js"));
    if (!check) {
      await writeFile(outfile, next);
    }
  }
}

const leftovers = (await readdir(outDir)).filter((name) => name.endsWith(".ts"));
if (leftovers.length > 0 && !check) {
  await Promise.all(leftovers.map((name) => rm(join(outDir, name))));
}

if (check && (stale.length > 0 || leftovers.length > 0)) {
  const details = [...stale.map((name) => `${name} is stale`), ...leftovers.map((name) => `${name} should not be deployed`)];
  throw new Error(`API bundles are out of date. Run npm run bundle-api.\n${details.join("\n")}`);
}

if (!check) {
  console.log(`Bundled ${entries.length} Vercel functions into api/.`);
}
