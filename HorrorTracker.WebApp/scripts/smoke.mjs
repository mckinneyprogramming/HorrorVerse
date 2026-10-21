import { pathToFileURL } from "node:url";

const checks = [
  { path: "/api/health", expect: (body, status) => status === 200 && body.status === "ok" },
  { path: "/api/catalog", expect: (body, status) => status === 200 && body !== null && typeof body === "object" },
  { path: "/api/auth", expect: (body, status) => status === 200 && body.user === null },
  { path: "/api/progress", expect: (_body, status) => status === 401 },
];

export async function runSmoke(env = process.env, fetchImpl = fetch, logger = console) {
  const base = env.SMOKE_URL?.replace(/\/$/, "");
  if (!base) {
    logger.log("SMOKE_URL is not set; skipping the deploy smoke check.");
    return 0;
  }

  let failed = 0;
  for (const check of checks) {
    const response = await fetchImpl(`${base}${check.path}`);
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (!check.expect(body, response.status)) {
      failed += 1;
      logger.error(`FAIL ${check.path} status=${response.status} body=${text.slice(0, 300)}`);
    } else {
      logger.log(`ok ${check.path}`);
    }
  }

  return failed > 0 ? 1 : 0;
}

export async function runIfDirect(metaUrl, argv = process.argv, env = process.env, fetchImpl = fetch, logger = console) {
  if (pathToFileURL(argv[1] ?? "").href !== metaUrl) {
    return;
  }

  process.exit(await runSmoke(env, fetchImpl, logger));
}

await runIfDirect(import.meta.url);
