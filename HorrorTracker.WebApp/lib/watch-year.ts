const FIRST_YEAR = 1888;

export function parseWatchYear(value: unknown, now = new Date()): number | undefined {
  const year = typeof value === "number" ? value : Number(String(value ?? "").trim());
  const last = now.getUTCFullYear() + 1;
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > last) {
    return undefined;
  }

  return year;
}

export function watchTimestamp(year: number): string {
  return `${year}-07-01T12:00:00.000Z`;
}

export function yearFromCompletedAt(value: unknown): number | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    return undefined;
  }

  return date.getUTCFullYear();
}
