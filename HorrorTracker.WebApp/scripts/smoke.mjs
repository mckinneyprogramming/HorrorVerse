const base = process.env.SMOKE_URL?.replace(/\/$/, "");
if (!base) {
  console.log("SMOKE_URL is not set; skipping the deploy smoke check.");
  process.exit(0);
}

const checks = [
  { path: "/api/health", expect: (body, status) => status === 200 && body.status === "ok" },
  { path: "/api/catalog", expect: (body, status) => status === 200 && body !== null && typeof body === "object" },
  { path: "/api/auth", expect: (body, status) => status === 200 && body.user === null },
  { path: "/api/progress", expect: (_body, status) => status === 401 },
];

let failed = 0;
for (const check of checks) {
  const response = await fetch(`${base}${check.path}`);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!check.expect(body, response.status)) {
    failed += 1;
    console.error(`FAIL ${check.path} status=${response.status} body=${text.slice(0, 300)}`);
  } else {
    console.log(`ok ${check.path}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
