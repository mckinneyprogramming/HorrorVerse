export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch("/api/auth");
    if (!response.ok) {
      return null;
    }

    return readUserPayload(await response.json());
  } catch {
    return null;
  }
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthUser> {
  return mutateAuth({ action: "register", ...input });
}

export async function loginAccount(input: { email: string; password: string }): Promise<AuthUser> {
  return mutateAuth({ action: "login", ...input });
}

export async function logoutAccount(): Promise<void> {
  await fetch("/api/auth", { method: "DELETE" });
}

async function mutateAuth(body: Record<string, string>): Promise<AuthUser> {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readError(payload, response.status));
  }

  const user = readUserPayload(payload);
  if (!user) {
    throw new Error("Could not sign in.");
  }

  return user;
}

function readUserPayload(payload: unknown): AuthUser | null {
  if (typeof payload !== "object" || payload === null || !("user" in payload)) {
    return null;
  }

  const user = (payload as { user: unknown }).user;
  if (typeof user !== "object" || user === null) {
    return null;
  }

  const record = user as Partial<AuthUser>;
  if (
    typeof record.id !== "number" ||
    typeof record.email !== "string" ||
    typeof record.displayName !== "string" ||
    typeof record.isAdmin !== "boolean"
  ) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    isAdmin: record.isAdmin,
  };
}

function readError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }

  return `Account request failed (${status})`;
}
