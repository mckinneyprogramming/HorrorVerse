import { mockNeon, type NeonMock, type NeonStep } from "./neon";

export const TEST_CONN = "postgresql://horror:secret@ep-test.neon.tech/HorrorVerse";

export function testConn(name: string): string {
  return `postgresql://horror:secret@ep-test.neon.tech/${encodeURIComponent(name)}`;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

export function unreachableNetwork(url: string): Response {
  throw new Error(`Unexpected network call: ${url}`);
}

export async function withNeonFetch(
  env: Record<string, string | undefined>,
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  steps: NeonStep[],
  run: (neon: NeonMock) => Promise<void>,
): Promise<NeonMock> {
  const previousEnv = Object.keys(env).map((key) => [key, process.env[key]] as const);
  const previousFetch = globalThis.fetch;
  let neon: NeonMock | undefined;
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
    neon = mockNeon(steps);
    await run(neon);
    return neon;
  } finally {
    neon?.restore();
    globalThis.fetch = previousFetch;
    for (const [key, value] of previousEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
