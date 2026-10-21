const TEST_DATABASE_URL = "postgresql://horror:secret@ep-test.neon.tech/HorrorVerse";

export interface NeonStep {
  match: string | RegExp;
  rows?: Record<string, unknown>[];
  error?: string;
  status?: number;
  body?: string;
  once?: boolean;
}

export interface NeonCall {
  query: string;
  params: unknown[];
}

export interface NeonMock {
  calls: NeonCall[];
  restore: () => void;
}

export function mockNeon(steps: NeonStep[] = []): NeonMock {
  const previousUrl = process.env.DATABASE_URL;
  const previousHorror = process.env.HorrorVerseDb;
  const previousAdmin = process.env.ADMIN_EMAIL;
  const previousFetch = globalThis.fetch;
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  delete process.env.HorrorVerseDb;

  const calls: NeonCall[] = [];
  const pending = steps.map((step) => ({ ...step }));

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes("/sql")) {
      return previousFetch(input, init);
    }

    const body = JSON.parse(String(init?.body)) as { query: string; params?: unknown[] };
    const params = body.params ?? [];
    calls.push({ query: body.query, params });
    const index = pending.findIndex((step) =>
      typeof step.match === "string" ? body.query.includes(step.match) : step.match.test(body.query),
    );
    const step = index >= 0 ? pending[index] : undefined;
    if (step?.once) {
      pending.splice(index, 1);
    }

    if (step?.body !== undefined) {
      return new Response(step.body, { status: step.status ?? 500 });
    }

    if (step?.error) {
      return new Response(JSON.stringify({ message: step.error }), { status: step.status ?? 400 });
    }

    return new Response(JSON.stringify({ rows: step?.rows ?? [] }), {
      status: step?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };

  return {
    calls,
    restore() {
      globalThis.fetch = previousFetch;
      restoreEnv("DATABASE_URL", previousUrl);
      restoreEnv("HorrorVerseDb", previousHorror);
      restoreEnv("ADMIN_EMAIL", previousAdmin);
    },
  };
}

function restoreEnv(name: "DATABASE_URL" | "HorrorVerseDb" | "ADMIN_EMAIL", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
