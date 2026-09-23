export const runtime = "nodejs";
export const maxDuration = 30;

import { parseCatalogId } from "../lib/catalog-id";
import {
  execute,
  HttpError,
  jsonError,
  queryRows,
  requireDatabaseUrl,
  requireSessionUser,
} from "../lib/neon";

const ALLOWED_KINDS = ["movie", "series", "show", "book", "game"] as const;

interface FranchiseWriteBody {
  id?: number;
  franchiseId?: number;
  name?: string;
  itemId?: string;
}

export async function GET() {
  try {
    const connectionString = requireDatabaseUrl();
    await ensureFranchiseSchema(connectionString);
    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error, { log: "Franchise request failed.", fallback: "Could not update franchises." });
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as FranchiseWriteBody;
    if (body.itemId) {
      await addItem(connectionString, body);
    } else {
      await createFranchise(connectionString, body.name);
    }

    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error, { log: "Franchise request failed.", fallback: "Could not update franchises." });
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as FranchiseWriteBody;
    await renameFranchise(connectionString, body.id ?? body.franchiseId, body.name);
    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error, { log: "Franchise request failed.", fallback: "Could not update franchises." });
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    await requireAdmin(request, connectionString);
    const url = new URL(request.url);
    if (url.searchParams.get("itemId")) {
      await removeItem(connectionString, Number(url.searchParams.get("franchiseId") ?? url.searchParams.get("id")), url.searchParams.get("itemId"));
    } else {
      await deleteFranchise(connectionString, Number(url.searchParams.get("id")));
    }

    return Response.json({ franchises: await loadFranchises(connectionString) });
  } catch (error) {
    return jsonError(error, { log: "Franchise request failed.", fallback: "Could not update franchises." });
  }
}

async function loadFranchises(connectionString: string) {
  const rows = await queryRows(
    connectionString,
    `SELECT f.id, f.name, i.media_kind, i.media_id
     FROM franchise f
     LEFT JOIN franchise_item i ON i.franchise_id = f.id
     ORDER BY lower(f.name), f.id, i.added_at, i.media_kind, i.media_id`,
  );

  const franchises: { id: number; name: string; items: string[] }[] = [];
  const indexById = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.id);
    let index = indexById.get(id);
    if (index === undefined) {
      index = franchises.length;
      indexById.set(id, index);
      franchises.push({ id, name: String(row.name ?? ""), items: [] });
    }

    if (row.media_kind == null || row.media_id == null) {
      continue;
    }

    franchises[index].items.push(`${String(row.media_kind)}:${Number(row.media_id)}`);
  }

  return franchises;
}

async function createFranchise(connectionString: string, name: string | undefined): Promise<void> {
  const trimmed = normalizeName(name);
  const countRows = await queryRows(connectionString, "SELECT COUNT(*)::int AS count FROM franchise");
  if (Number(countRows[0]?.count) >= 80) {
    throw new FranchiseError("The vault already has 80 franchises.", 400);
  }

  try {
    await execute(connectionString, "INSERT INTO franchise (name) VALUES ($1)", [trimmed]);
  } catch (error) {
    throw duplicateNameError(error);
  }
}

async function renameFranchise(connectionString: string, franchiseId: number | undefined, name: string | undefined): Promise<void> {
  const id = requireFranchiseId(franchiseId);
  const trimmed = normalizeName(name);
  try {
    const rows = await queryRows(connectionString, "UPDATE franchise SET name = $1 WHERE id = $2 RETURNING id", [trimmed, id]);
    if (rows.length < 1) {
      throw new FranchiseError("That franchise was not found.", 400);
    }
  } catch (error) {
    throw duplicateNameError(error);
  }
}

async function deleteFranchise(connectionString: string, franchiseId: number): Promise<void> {
  const id = requireFranchiseId(franchiseId);
  const rows = await queryRows(connectionString, "DELETE FROM franchise WHERE id = $1 RETURNING id", [id]);
  if (rows.length < 1) {
    throw new FranchiseError("That franchise was not found.", 400);
  }
}

async function addItem(connectionString: string, body: FranchiseWriteBody): Promise<void> {
  const franchiseId = await requireExisting(connectionString, body.franchiseId ?? body.id);
  const { kind, mediaId } = parseCatalogId(body.itemId, ALLOWED_KINDS, "Franchises can hold series, movies, shows, and books.");
  const countRows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM franchise_item WHERE franchise_id = $1",
    [franchiseId],
  );
  if (Number(countRows[0]?.count) >= 200) {
    throw new FranchiseError("That franchise is full.", 400);
  }

  await execute(
    connectionString,
    `INSERT INTO franchise_item (franchise_id, media_kind, media_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (franchise_id, media_kind, media_id) DO NOTHING`,
    [franchiseId, kind, mediaId],
  );
  if (kind === "series") {
    await addSeriesMovies(connectionString, franchiseId, mediaId);
  }
}

async function removeItem(connectionString: string, franchiseId: number, itemId: string | null): Promise<void> {
  const id = await requireExisting(connectionString, franchiseId);
  const { kind, mediaId } = parseCatalogId(itemId, ALLOWED_KINDS, "Franchises can hold series, movies, shows, and books.");
  await execute(
    connectionString,
    "DELETE FROM franchise_item WHERE franchise_id = $1 AND media_kind = $2 AND media_id = $3",
    [id, kind, mediaId],
  );
  if (kind === "series") {
    await removeSeriesMovies(connectionString, id, mediaId);
  }
}

async function addSeriesMovies(connectionString: string, franchiseId: number, seriesId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `INSERT INTO franchise_item (franchise_id, media_kind, media_id)
       SELECT $1, 'movie', id
       FROM movie
       WHERE seriesid = $2
       ON CONFLICT DO NOTHING`,
      [franchiseId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function removeSeriesMovies(connectionString: string, franchiseId: number, seriesId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `DELETE FROM franchise_item
       WHERE franchise_id = $1
         AND media_kind = 'movie'
         AND media_id IN (SELECT id FROM movie WHERE seriesid = $2)`,
      [franchiseId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function requireExisting(connectionString: string, franchiseId: number | undefined): Promise<number> {
  const id = requireFranchiseId(franchiseId);
  const rows = await queryRows(connectionString, "SELECT 1 FROM franchise WHERE id = $1", [id]);
  if (rows.length < 1) {
    throw new FranchiseError("That franchise was not found.", 400);
  }

  return id;
}

function requireFranchiseId(id: number | undefined): number {
  if (!Number.isInteger(id) || Number(id) < 1) {
    throw new FranchiseError("That franchise was not found.", 400);
  }

  return Number(id);
}

function normalizeName(name: string | undefined): string {
  const value = (name ?? "").trim();
  if (value.length < 1 || value.length > 80) {
    throw new FranchiseError("Enter a franchise name.", 400);
  }

  return value;
}

function duplicateNameError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("franchise_name_idx") || message.includes("duplicate key")) {
    return new FranchiseError("A franchise with that name already exists.", 400);
  }

  return error instanceof Error ? error : new Error("Could not save that franchise.");
}

async function requireAdmin(request: Request, connectionString: string): Promise<void> {
  await ensureFranchiseSchema(connectionString);
  const user = await requireSessionUser(request, connectionString);
  if (!user.isAdmin) {
    throw new FranchiseError("Only the administrator can change franchises.", 403);
  }
}

async function ensureFranchiseSchema(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS franchise (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  );
  try {
    await execute(connectionString, "CREATE UNIQUE INDEX IF NOT EXISTS franchise_name_idx ON franchise (lower(name))");
  } catch {
    // Neon HTTP may reject expression indexes; duplicate names are still checked on insert.
  }
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS franchise_item (
        franchise_id INTEGER NOT NULL REFERENCES franchise(id) ON DELETE CASCADE,
        media_kind TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (franchise_id, media_kind, media_id)
      )`,
  );
}

class FranchiseError extends HttpError {}
