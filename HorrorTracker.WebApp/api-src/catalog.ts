export const runtime = "nodejs";
export const maxDuration = 30;
void "restore-standalone-catalog";

import { parseCatalogId } from "../lib/catalog-id";
import {
  execute,
  HttpError,
  jsonError,
  queryRows,
  readSessionToken,
  requireDatabaseUrl,
  resolveDatabaseUrl,
} from "../lib/neon";

const CATALOG_KINDS = ["movie", "series", "documentary", "show", "book"] as const;

interface CatalogItem {
  id: string;
  mediaId: number;
  title: string;
  kind: string;
  completed: boolean;
  totalTime?: number;
  releaseYear?: number;
  seriesId?: number;
  seriesTitle?: string;
  totalEpisodes?: number;
  numberOfSeasons?: number;
  keywords?: string[];
}

export async function GET() {
  try {
    return Response.json(await loadCatalog());
  } catch (error) {
    return jsonError(error, { log: "Catalog request failed.", fallback: "Catalog unavailable." });
  }
}

export async function POST(request: Request) {
  return writeCatalog(request, async (connectionString, body) => {
    const kind = normalizeKind(body.kind);
    const title = normalizeTitle(body.title);
    await ensureOptionalTables(connectionString, kind);
    await ensureUniqueTitle(connectionString, kind, title, writeYear(body));
    const rows = await queryRows(connectionString, insertSql(kind), insertParams(kind, title, body));
    const item = mapRows(rows, kind)[0];
    if (!item) {
      throw new CatalogError("Could not save that title.", 500);
    }

    return Response.json(item);
  });
}

export async function PATCH(request: Request) {
  return writeCatalog(request, async (connectionString, body) => {
    const { kind, mediaId } = parseCatalogId(body.id, CATALOG_KINDS);
    const title = normalizeTitle(body.title);
    await ensureOptionalTables(connectionString, kind);
    await ensureUniqueTitle(connectionString, kind, title, await currentYear(connectionString, kind, mediaId), mediaId);
    const rows = await queryRows(connectionString, updateSql(kind), [title, Boolean(body.completed), mediaId]);
    const item = mapRows(rows, kind)[0];
    if (!item) {
      throw new CatalogError("That title was not found.", 400);
    }

    return Response.json(item);
  });
}

export async function DELETE(request: Request) {
  return writeCatalog(request, async (connectionString, body, url) => {
    const { kind, mediaId } = parseCatalogId(body.id ?? url.searchParams.get("id"), CATALOG_KINDS);
    await ensureOptionalTables(connectionString, kind);
    await execute(connectionString, deleteSql(kind), [mediaId]);
    await purgeUserMedia(connectionString, kind, mediaId);
    await deleteKeywords(connectionString, kind, mediaId);
    return Response.json({ ok: true });
  });
}

async function loadCatalog(): Promise<CatalogItem[]> {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureOptionalTables(connectionString, "show");
  const items = [
    ...(await readTable(
      connectionString,
      `SELECT m.id,
              m.title,
              m.watched AS completed,
              m.totaltime,
              m.releaseyear,
              m.seriesid,
              s.title AS seriestitle
       FROM movie m
       LEFT JOIN movieseries s ON s.id = m.seriesid`,
      "movie",
    )),
    ...(await readTable(connectionString, "SELECT id, title, watched AS completed FROM movieseries", "series")),
    ...(await readTable(
      connectionString,
      "SELECT id, title, watched AS completed, totaltime, releaseyear FROM documentary",
      "documentary",
    )),
    ...(await readOptional(
      connectionString,
      "SELECT id, title, watched AS completed, totaltime, totalepisodes, numberofseasons, releaseyear FROM show",
      "show",
    )),
    ...(await readOptional(connectionString, "SELECT id, title, read AS completed FROM book", "book")),
  ];
  return attachKeywords(connectionString, items);
}

async function readTable(
  connectionString: string,
  query: string,
  kind: string,
): Promise<CatalogItem[]> {
  return mapRows(await queryRows(connectionString, query), kind);
}

async function readOptional(
  connectionString: string,
  query: string,
  kind: string,
): Promise<CatalogItem[]> {
  try {
    return await readTable(connectionString, query, kind);
  } catch (error) {
    console.error(`Optional catalog table ${kind} is unavailable.`, error);
    return [];
  }
}

async function attachKeywords(connectionString: string, items: CatalogItem[]): Promise<CatalogItem[]> {
  try {
    await execute(
      connectionString,
      `CREATE TABLE IF NOT EXISTS media_keyword (
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        tmdb_keyword_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        PRIMARY KEY (media_kind, media_id, tmdb_keyword_id)
      )`,
    );
    const rows = await queryRows(
      connectionString,
      "SELECT media_kind, media_id, name FROM media_keyword ORDER BY lower(name)",
    );
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const kind = String(row.media_kind ?? "");
      const mediaId = Number(row.media_id);
      const name = String(row.name ?? "").trim();
      if (!kind || !Number.isInteger(mediaId) || mediaId < 1 || !name) {
        continue;
      }

      const key = `${kind}:${mediaId}`;
      const names = grouped.get(key) ?? [];
      if (!names.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
        names.push(name);
        grouped.set(key, names);
      }
    }

    return items.map((item) => {
      const names = grouped.get(item.id);
      return names?.length ? { ...item, keywords: names } : item;
    });
  } catch {
    return items;
  }
}

async function deleteKeywords(connectionString: string, kind: string, mediaId: number): Promise<void> {
  try {
    await execute(connectionString, "DELETE FROM media_keyword WHERE media_kind = $1 AND media_id = $2", [kind, mediaId]);
  } catch {
    // Keyword table is created on first catalog read or TMDb import.
  }
}

async function purgeUserMedia(connectionString: string, kind: string, mediaId: number): Promise<void> {
  try {
    await execute(connectionString, "DELETE FROM user_media_progress WHERE media_kind = $1 AND media_id = $2", [
      kind,
      mediaId,
    ]);
    await execute(connectionString, "DELETE FROM user_list_item WHERE media_kind = $1 AND media_id = $2", [
      kind,
      mediaId,
    ]);
    await execute(connectionString, "DELETE FROM franchise_item WHERE media_kind = $1 AND media_id = $2", [
      kind,
      mediaId,
    ]);
    if (kind === "show") {
      await execute(
        connectionString,
        "DELETE FROM user_episode_progress WHERE episode_id IN (SELECT id FROM show_episode WHERE show_id = $1)",
        [mediaId],
      );
      await execute(connectionString, "DELETE FROM show_episode WHERE show_id = $1", [mediaId]);
      await execute(connectionString, "DELETE FROM show_season WHERE show_id = $1", [mediaId]);
    }
  } catch {
    // Progress tables are created on first signed-in use.
  }
}

interface CatalogWriteBody {
  id?: string;
  title?: string;
  kind?: string;
  completed?: boolean;
  releaseYear?: number;
  totalTime?: number;
  pages?: number;
  totalEpisodes?: number;
  numberOfSeasons?: number;
  totalMovies?: number;
}

async function writeCatalog(
  request: Request,
  action: (connectionString: string, body: CatalogWriteBody, url: URL) => Promise<Response>,
): Promise<Response> {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as CatalogWriteBody;
    return await action(connectionString, body, new URL(request.url));
  } catch (error) {
    return jsonError(error, {
      log: "Catalog write failed.",
      fallback: "Could not change the catalog.",
      unavailable: "Catalog unavailable.",
    });
  }
}

async function requireAdmin(request: Request, connectionString: string): Promise<void> {
  const token = readSessionToken(request);
  if (!token) {
    throw new CatalogError("Sign in to continue.", 401);
  }

  const rows = await queryRows(
    connectionString,
    `SELECT u.email, u.is_admin
     FROM app_session s
     JOIN app_user u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  const row = rows[0];
  if (!row) {
    throw new CatalogError("Sign in to continue.", 401);
  }

  const email = String(row.email ?? "").toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isAdmin = Boolean(row.is_admin ?? row.isAdmin) || Boolean(adminEmail && email === adminEmail);
  if (!isAdmin) {
    throw new CatalogError("Only the administrator can change the catalog.", 403);
  }
}

async function ensureOptionalTables(connectionString: string, kind: string): Promise<void> {
  if (kind === "show") {
    await execute(
      connectionString,
      `CREATE TABLE IF NOT EXISTS show (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        totaltime DECIMAL(10, 2) NOT NULL,
        totalepisodes INTEGER NOT NULL,
        numberofseasons INTEGER NOT NULL,
        watched BOOLEAN NOT NULL
      )`,
    );
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
    await execute(connectionString, "ALTER TABLE show ADD COLUMN IF NOT EXISTS releaseyear INTEGER");
  }

  if (kind === "book") {
    await execute(
      connectionString,
      `CREATE TABLE IF NOT EXISTS book (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        seriesid INTEGER,
        pages INTEGER NOT NULL,
        partofseries BOOLEAN NOT NULL,
        releaseyear INTEGER NOT NULL,
        read BOOLEAN NOT NULL
      )`,
    );
  }
}

function insertSql(kind: string): string {
  switch (kind) {
    case "movie":
      return `INSERT INTO movie (title, totaltime, partofseries, seriesid, releaseyear, watched)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, watched AS completed`;
    case "series":
      return `INSERT INTO movieseries (title, totaltime, totalmovies, watched)
              VALUES ($1, $2, $3, $4) RETURNING id, title, watched AS completed`;
    case "documentary":
      return `INSERT INTO documentary (title, totaltime, releaseyear, watched)
              VALUES ($1, $2, $3, $4) RETURNING id, title, watched AS completed`;
    case "show":
      return `INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, watched AS completed`;
    case "book":
      return `INSERT INTO book (title, seriesid, pages, partofseries, releaseyear, read)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, read AS completed`;
    default:
      throw new CatalogError("That type cannot be stored yet.", 400);
  }
}

function writeYear(body: CatalogWriteBody): number {
  return Number.isInteger(body.releaseYear) && (body.releaseYear ?? 0) > 0
    ? Number(body.releaseYear)
    : new Date().getUTCFullYear();
}

async function ensureUniqueTitle(
  connectionString: string,
  kind: string,
  title: string,
  year: number,
  excludeId?: number,
): Promise<void> {
  if (await findExistingId(connectionString, kind, title, year, excludeId)) {
    throw new CatalogError("That title is already in the catalog.", 400);
  }
}

async function findExistingId(
  connectionString: string,
  kind: string,
  title: string,
  year: number,
  excludeId?: number,
): Promise<number | undefined> {
  const exclude = excludeId ?? 0;
  const query = existingIdSql(kind);
  try {
    const rows = await queryRows(connectionString, query, [title, year, exclude]);
    const id = Number(rows[0]?.id);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

function existingIdSql(kind: string): string {
  switch (kind) {
    case "movie":
      return `SELECT id FROM movie
              WHERE lower(title) = lower($1) AND releaseyear = $2
                AND ($3 = 0 OR id <> $3)
              LIMIT 1`;
    case "series":
      return `SELECT id FROM movieseries
              WHERE lower(title) = lower($1)
                AND ($3 = 0 OR id <> $3)
              LIMIT 1`;
    case "documentary":
      return `SELECT id FROM documentary
              WHERE lower(title) = lower($1) AND releaseyear = $2
                AND ($3 = 0 OR id <> $3)
              LIMIT 1`;
    case "show":
      return `SELECT id FROM show
              WHERE lower(title) = lower($1) AND COALESCE(releaseyear, 0) = $2
                AND ($3 = 0 OR id <> $3)
              LIMIT 1`;
    case "book":
      return `SELECT id FROM book
              WHERE lower(title) = lower($1) AND releaseyear = $2
                AND ($3 = 0 OR id <> $3)
              LIMIT 1`;
    default:
      throw new CatalogError("That type cannot be stored yet.", 400);
  }
}

async function currentYear(connectionString: string, kind: string, mediaId: number): Promise<number> {
  if (kind === "series") {
    return 0;
  }

  const query =
    kind === "movie"
      ? "SELECT releaseyear FROM movie WHERE id = $1"
      : kind === "documentary"
        ? "SELECT releaseyear FROM documentary WHERE id = $1"
        : kind === "show"
          ? "SELECT releaseyear FROM show WHERE id = $1"
          : kind === "book"
            ? "SELECT releaseyear FROM book WHERE id = $1"
            : null;
  if (!query) {
    return 0;
  }

  try {
    const rows = await queryRows(connectionString, query, [mediaId]);
    const year = Number(rows[0]?.releaseyear);
    return Number.isInteger(year) ? year : 0;
  } catch {
    return 0;
  }
}

function insertParams(kind: string, title: string, body: CatalogWriteBody): unknown[] {
  const year = writeYear(body);
  const totalTime = typeof body.totalTime === "number" && body.totalTime >= 0 ? body.totalTime : 0;
  const completed = Boolean(body.completed);

  switch (kind) {
    case "movie":
      return [title, totalTime, false, null, year, completed];
    case "series":
      return [title, totalTime, Math.max(Number(body.totalMovies) || 0, 0), completed];
    case "documentary":
      return [title, totalTime, year, completed];
    case "show":
      return [title, totalTime, Math.max(Number(body.totalEpisodes) || 0, 0), Math.max(Number(body.numberOfSeasons) || 0, 0), completed, year];
    case "book":
      return [title, null, Math.max(Number(body.pages) || 0, 0), false, year, completed];
    default:
      throw new CatalogError("That type cannot be stored yet.", 400);
  }
}

function updateSql(kind: string): string {
  switch (kind) {
    case "movie":
      return "UPDATE movie SET title = $1, watched = $2 WHERE id = $3 RETURNING id, title, watched AS completed";
    case "series":
      return "UPDATE movieseries SET title = $1, watched = $2 WHERE id = $3 RETURNING id, title, watched AS completed";
    case "documentary":
      return "UPDATE documentary SET title = $1, watched = $2 WHERE id = $3 RETURNING id, title, watched AS completed";
    case "show":
      return "UPDATE show SET title = $1, watched = $2 WHERE id = $3 RETURNING id, title, watched AS completed";
    case "book":
      return "UPDATE book SET title = $1, read = $2 WHERE id = $3 RETURNING id, title, read AS completed";
    default:
      throw new CatalogError("That type cannot be stored yet.", 400);
  }
}

function deleteSql(kind: string): string {
  switch (kind) {
    case "movie":
      return "DELETE FROM movie WHERE id = $1";
    case "series":
      return "DELETE FROM movieseries WHERE id = $1";
    case "documentary":
      return "DELETE FROM documentary WHERE id = $1";
    case "show":
      return "DELETE FROM show WHERE id = $1";
    case "book":
      return "DELETE FROM book WHERE id = $1";
    default:
      throw new CatalogError("That type cannot be stored yet.", 400);
  }
}

function normalizeKind(kind: string | undefined): string {
  const value = (kind ?? "").trim().toLowerCase();
  if (value === "movie" || value === "series" || value === "documentary" || value === "show" || value === "book") {
    return value;
  }

  throw new CatalogError("That type cannot be stored yet.", 400);
}

function normalizeTitle(title: string | undefined): string {
  const value = (title ?? "").trim();
  if (value.length < 1 || value.length > 200) {
    throw new CatalogError("Enter a title.", 400);
  }

  return value;
}

class CatalogError extends HttpError {}

function mapRows(rows: Record<string, unknown>[], kind: string): CatalogItem[] {
  return rows.map((row) => {
    const mediaId = Number(row.id);
    const item: CatalogItem = {
      id: `${kind}:${mediaId}`,
      mediaId,
      title: String(row.title ?? ""),
      kind,
      completed: Boolean(row.completed),
    };

    const totalTime = asFiniteNumber(row.totaltime ?? row.totalTime);
    const releaseYear = asFiniteNumber(row.releaseyear ?? row.releaseYear);
    const seriesId = asFiniteNumber(row.seriesid ?? row.seriesId);
    const seriesTitle = asNonEmptyString(row.seriestitle ?? row.seriesTitle);
    if (totalTime !== undefined && totalTime > 0) {
      item.totalTime = totalTime;
    }

    if (releaseYear !== undefined && releaseYear > 0) {
      item.releaseYear = releaseYear;
    }

    if (seriesId !== undefined && seriesId > 0) {
      item.seriesId = seriesId;
    }

    if (seriesTitle) {
      item.seriesTitle = seriesTitle;
    }

    const totalEpisodes = asFiniteNumber(row.totalepisodes ?? row.totalEpisodes);
    const numberOfSeasons = asFiniteNumber(row.numberofseasons ?? row.numberOfSeasons);
    if (totalEpisodes !== undefined && totalEpisodes > 0) {
      item.totalEpisodes = totalEpisodes;
    }

    if (numberOfSeasons !== undefined && numberOfSeasons > 0) {
      item.numberOfSeasons = numberOfSeasons;
    }

    return item;
  });
}

function asFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

