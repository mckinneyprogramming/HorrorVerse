import { mockNeon, type NeonMock, type NeonStep } from "./neon";

export const SESSION = "session-token";

export const memberRow = {
  id: 1,
  email: "member@example.com",
  display_name: "Member",
  is_admin: false,
};

export const adminRow = {
  id: 2,
  email: "admin@example.com",
  display_name: "Admin",
  is_admin: true,
};

export function sessionStep(row: Record<string, unknown> = memberRow): NeonStep {
  return { match: "FROM app_session", rows: [{ ...row }] };
}

export interface ExternalRoute {
  match: string | RegExp;
  body?: unknown;
  status?: number;
  raw?: BodyInit;
  headers?: Record<string, string>;
}

export interface ApiOptions {
  env?: Record<string, string | undefined>;
  external?: ExternalRoute[];
  fetch?: (url: string, init: RequestInit | undefined) => Response | undefined | Promise<Response | undefined>;
}

export interface ApiHandle {
  calls: NeonMock["calls"];
  restore: () => void;
}

export function installApi(steps: NeonStep[] = [], options: ApiOptions = {}): ApiHandle {
  const savedEnv = new Map<string, string | undefined>();
  const remember = (key: string) => {
    if (!savedEnv.has(key)) {
      savedEnv.set(key, process.env[key]);
    }
  };

  for (const key of ["TMDBKey", "VERCEL", "CRON_SECRET", "IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"]) {
    remember(key);
  }

  for (const key of Object.keys(options.env ?? {})) {
    remember(key);
  }

  const neon = mockNeon(steps);
  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const neonFetch = globalThis.fetch;
  const routes = options.external ?? [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/sql")) {
      return neonFetch(input, init);
    }

    const custom = options.fetch ? await options.fetch(url, init) : undefined;
    if (custom) {
      return custom;
    }

    if (url.includes("id.twitch.tv/oauth2/token")) {
      return Response.json({ access_token: "twitch-token", expires_in: 3600 });
    }

    const route = routes.find((item) => (typeof item.match === "string" ? url.includes(item.match) : item.match.test(url)));
    if (route?.raw !== undefined) {
      return new Response(route.raw, { status: route.status ?? 200, headers: route.headers });
    }

    if (route?.status && route.status >= 400) {
      return new Response(JSON.stringify(route.body ?? { message: "upstream failed" }), {
        status: route.status,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("image.tmdb.org") && !route) {
      return new Response(Uint8Array.from([255, 216, 255, 217]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }

    const fallback = url.includes("api.igdb.com") ? [] : url.includes("openlibrary.org") ? { docs: [] } : {};
    return Response.json(route?.body ?? fallback, { status: route?.status ?? 200 });
  };

  return {
    calls: neon.calls,
    restore() {
      neon.restore();
      for (const [key, value] of savedEnv) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

export function authed(url: string, init: RequestInit = {}, token: string | null = SESSION): Request {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("cookie", `hv_session=${encodeURIComponent(token)}`);
  }

  return new Request(url, { ...init, headers });
}

export function jsonCall(url: string, method: string, body: unknown, token: string | null = SESSION): Request {
  return authed(
    url,
    {
      method,
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    token,
  );
}

export async function readBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}
