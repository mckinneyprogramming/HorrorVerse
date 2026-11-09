import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const checks = [
  { path: "/api/health", expect: (body, status) => status === 200 && body.status === "ok" },
  { path: "/api/catalog", expect: (body, status) => status === 200 && body !== null && typeof body === "object" },
  { path: "/api/auth", expect: (body, status) => status === 200 && body.user === null },
  { path: "/api/progress", expect: (_body, status) => status === 401 },
];

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function smokeJunit(cases) {
  const failures = cases.filter((item) => item.failed).length;
  const skipped = cases.filter((item) => item.skipped).length;
  const body = cases
    .map((item) => {
      const name = escapeXml(item.name);
      if (item.skipped) {
        return `    <testcase classname="deploy-smoke" name="${name}"><skipped/></testcase>`;
      }
      if (item.failed) {
        return `    <testcase classname="deploy-smoke" name="${name}"><failure message="${escapeXml(item.message)}"/></testcase>`;
      }
      return `    <testcase classname="deploy-smoke" name="${name}"/>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="deploy-smoke" tests="${cases.length}" failures="${failures}" skipped="${skipped}">\n${body}\n</testsuite>\n`;
}

async function writeSmokeReport(env, cases) {
  const reportPath = env.SMOKE_JUNIT;
  if (!reportPath) {
    return;
  }

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, smokeJunit(cases), "utf8");
}

export async function runSmoke(env = process.env, fetchImpl = fetch, logger = console) {
  const base = env.SMOKE_URL?.replace(/\/$/, "");
  if (!base) {
    logger.log("SMOKE_URL is not set; skipping the deploy smoke check.");
    await writeSmokeReport(env, [{ name: "live deploy", skipped: true }]);
    return 0;
  }

  let failed = 0;
  const cases = [];
  for (const check of checks) {
    const response = await fetchImpl(`${base}${check.path}`);
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    const detail = `status=${response.status} body=${text.slice(0, 300)}`;
    if (!check.expect(body, response.status)) {
      failed += 1;
      logger.error(`FAIL ${check.path} ${detail}`);
      cases.push({ name: check.path, failed: true, message: detail });
    } else {
      logger.log(`ok ${check.path}`);
      cases.push({ name: check.path });
    }
  }

  await writeSmokeReport(env, cases);
  return failed > 0 ? 1 : 0;
}

export async function runIfDirect(metaUrl, argv = process.argv, env = process.env, fetchImpl = fetch, logger = console) {
  if (pathToFileURL(argv[1] ?? "").href !== metaUrl) {
    return;
  }

  process.exit(await runSmoke(env, fetchImpl, logger));
}

await runIfDirect(import.meta.url);
