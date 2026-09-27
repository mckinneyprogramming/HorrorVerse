import { ensureKeywordSchema } from "./keywords";
import { ensureImportSchema, importMovie, importSeries } from "./import-tmdb";
import { execute, queryRows } from "./neon";
import { asId, asResults, collectionIsHorrorAdjacent, isDocumentary, tmdbJson } from "./tmdb";

const HORROR_GENRE = 27;
const FILM_BATCH = 8;
const COLLECTION_BATCH = 6;
const WINDOW_YEARS = 5;
const FIRST_YEAR = 1895;
const MAX_DISCOVER_PAGE = 500;

export type HorrorImportKind = "horror-films" | "horror-collections";

export interface HorrorImportProgress {
  import: HorrorImportKind;
  done: boolean;
  added: number;
  skipped: number;
  batchAdded: number;
  batchSkipped: number;
  queued: number;
  label: string;
}

interface FilmCursor {
  fromYear: number;
  page: number;
  index: number;
  done: boolean;
}

export function filmWindows(now = new Date()): { fromYear: number; from: string; to: string }[] {
  const last = now.getUTCFullYear() + 1;
  const windows: { fromYear: number; from: string; to: string }[] = [];
  for (let year = FIRST_YEAR; year <= last; year += WINDOW_YEARS) {
    const end = Math.min(year + WINDOW_YEARS - 1, last);
    windows.push({ fromYear: year, from: `${year}-01-01`, to: `${end}-12-31` });
  }

  return windows;
}

export function nextFilmCursor(
  cursor: FilmCursor,
  consumed: number,
  pageCount: number,
  resultCount: number,
  windows: { fromYear: number }[],
): FilmCursor {
  const index = cursor.index + consumed;
  if (index < resultCount) {
    return { ...cursor, index, done: false };
  }

  if (cursor.page < pageCount && cursor.page < MAX_DISCOVER_PAGE) {
    return { fromYear: cursor.fromYear, page: cursor.page + 1, index: 0, done: false };
  }

  const windowIndex = windows.findIndex((window) => window.fromYear === cursor.fromYear);
  const next = windows[windowIndex + 1];
  if (!next) {
    return { fromYear: cursor.fromYear, page: cursor.page, index, done: true };
  }

  return { fromYear: next.fromYear, page: 1, index: 0, done: false };
}

export async function importHorrorBatch(
  connectionString: string,
  kind: HorrorImportKind,
): Promise<HorrorImportProgress> {
  await ensureImportSchema(connectionString);
  await ensureKeywordSchema(connectionString);
  return kind === "horror-collections"
    ? importCollectionBatch(connectionString)
    : importFilmBatch(connectionString);
}

async function importFilmBatch(connectionString: string): Promise<HorrorImportProgress> {
  const windows = filmWindows();
  const stored = await loadCursor(connectionString, "horror-films");
  let cursor = parseFilmCursor(stored.cursor, windows);
  if (cursor.done) {
    cursor = { fromYear: windows[0].fromYear, page: 1, index: 0, done: false };
  }

  const window = windows.find((item) => item.fromYear === cursor.fromYear) ?? windows[0];
  const payload = await tmdbJson(
    `/discover/movie?include_adult=false&include_video=false&language=en-US&page=${cursor.page}` +
      `&sort_by=primary_release_date.asc&with_genres=${HORROR_GENRE}` +
      `&primary_release_date.gte=${encodeURIComponent(window.from)}` +
      `&primary_release_date.lte=${encodeURIComponent(window.to)}`,
  );
  const results = asResults(payload).filter((item) => !isDocumentary(item.genre_ids));
  const pageCount = Math.min(Math.max(Number(payload.total_pages) || 1, 1), MAX_DISCOVER_PAGE);
  const slice = results.slice(cursor.index, cursor.index + FILM_BATCH);
  let batchAdded = 0;
  let batchSkipped = 0;

  for (const item of slice) {
    const tmdbId = asId(item);
    if (!tmdbId) {
      batchSkipped += 1;
      continue;
    }

    try {
      const imported = await importMovie(connectionString, tmdbId);
      if (imported.added > 0) {
        batchAdded += imported.added;
      } else {
        batchSkipped += 1;
      }
    } catch {
      batchSkipped += 1;
    }
  }

  const next = nextFilmCursor(cursor, slice.length, pageCount, results.length, windows);
  const added = stored.added + batchAdded;
  const skipped = stored.skipped + batchSkipped;
  await saveCursor(connectionString, "horror-films", next, added, skipped);
  const nextWindow = windows.find((item) => item.fromYear === next.fromYear) ?? window;
  return {
    import: "horror-films",
    done: next.done,
    added,
    skipped,
    batchAdded,
    batchSkipped,
    queued: await queuedCollectionCount(connectionString),
    label: next.done
      ? "Horror films are imported."
      : `Films ${nextWindow.from.slice(0, 4)}–${nextWindow.to.slice(0, 4)}, page ${next.page}.`,
  };
}

async function importCollectionBatch(connectionString: string): Promise<HorrorImportProgress> {
  const stored = await loadCursor(connectionString, "horror-collections");
  const rows = await queryRows(
    connectionString,
    "SELECT tmdbid FROM catalog_import_collection WHERE imported_at IS NULL ORDER BY queued_at, tmdbid LIMIT $1",
    [COLLECTION_BATCH],
  );
  let batchAdded = 0;
  let batchSkipped = 0;

  for (const row of rows) {
    const tmdbId = asId(row, "tmdbid");
    if (!tmdbId) {
      continue;
    }

    try {
      if (!(await collectionIsHorrorAdjacent(tmdbId))) {
        batchSkipped += 1;
        await markCollectionImported(connectionString, tmdbId);
        continue;
      }

      const imported = await importSeries(connectionString, tmdbId);
      if (imported.added > 0) {
        batchAdded += imported.added;
      } else {
        batchSkipped += 1;
      }
    } catch {
      batchSkipped += 1;
    }

    await markCollectionImported(connectionString, tmdbId);
  }

  const added = stored.added + batchAdded;
  const skipped = stored.skipped + batchSkipped;
  const remaining = await queuedCollectionCount(connectionString);
  const done = remaining < 1;
  await saveCursor(connectionString, "horror-collections", { done }, added, skipped);
  return {
    import: "horror-collections",
    done,
    added,
    skipped,
    batchAdded,
    batchSkipped,
    queued: remaining,
    label: done ? "Horror collections are imported." : `${remaining} collection${remaining === 1 ? "" : "s"} still queued.`,
  };
}

async function queuedCollectionCount(connectionString: string): Promise<number> {
  const rows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM catalog_import_collection WHERE imported_at IS NULL",
  );
  return Number(rows[0]?.count) || 0;
}

async function markCollectionImported(connectionString: string, tmdbId: number): Promise<void> {
  await execute(
    connectionString,
    "UPDATE catalog_import_collection SET imported_at = NOW() WHERE tmdbid = $1",
    [tmdbId],
  );
}

async function loadCursor(
  connectionString: string,
  id: HorrorImportKind,
): Promise<{ cursor: Record<string, unknown>; added: number; skipped: number }> {
  const rows = await queryRows(connectionString, "SELECT cursor, added, skipped FROM catalog_import WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) {
    return { cursor: {}, added: 0, skipped: 0 };
  }

  return {
    cursor: asCursor(row.cursor),
    added: Number(row.added) || 0,
    skipped: Number(row.skipped) || 0,
  };
}

async function saveCursor(
  connectionString: string,
  id: HorrorImportKind,
  cursor: Record<string, unknown>,
  added: number,
  skipped: number,
): Promise<void> {
  await execute(
    connectionString,
    `INSERT INTO catalog_import (id, cursor, added, skipped, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET cursor = EXCLUDED.cursor, added = EXCLUDED.added, skipped = EXCLUDED.skipped, updated_at = NOW()`,
    [id, JSON.stringify(cursor), added, skipped],
  );
}

function asCursor(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function parseFilmCursor(cursor: Record<string, unknown>, windows: { fromYear: number }[]): FilmCursor {
  const fromYear = Number(cursor.fromYear);
  const page = Number(cursor.page);
  const index = Number(cursor.index);
  if (!windows.some((window) => window.fromYear === fromYear) || !Number.isInteger(page) || page < 1) {
    return { fromYear: windows[0].fromYear, page: 1, index: 0, done: false };
  }

  return {
    fromYear,
    page,
    index: Number.isInteger(index) && index > 0 ? index : 0,
    done: Boolean(cursor.done),
  };
}
