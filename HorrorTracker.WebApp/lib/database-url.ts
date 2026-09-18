export function resolveDatabaseUrl(): string | undefined {
  const fromUrl = process.env.DATABASE_URL?.trim();
  if (fromUrl) {
    return fromUrl;
  }

  const horrorVerseDb = process.env.HorrorVerseDb?.trim();
  if (!horrorVerseDb) {
    return undefined;
  }

  if (/^postgres(ql)?:\/\//i.test(horrorVerseDb)) {
    return horrorVerseDb;
  }

  return npgsqlToUri(horrorVerseDb);
}

function npgsqlToUri(connectionString: string): string {
  const values = new Map<string, string>();
  for (const part of connectionString.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }

    values.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }

  const host = values.get("host");
  const user = values.get("username") ?? values.get("user");
  const password = values.get("password") ?? "";
  const database = values.get("database") ?? "HorrorTracker";
  if (!host || !user) {
    throw new Error("HorrorVerseDb is missing Host or Username.");
  }

  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgresql://${auth}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}
