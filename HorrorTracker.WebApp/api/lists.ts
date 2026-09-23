export const runtime = "nodejs";
export const maxDuration = 30;
void "restore-standalone-lists";

import {
  ensureUserLibrarySchema,
  execute,
  HttpError,
  jsonError as neonJsonError,
  queryRows,
  requireDatabaseUrl,
  requireSessionUser,
  type SessionUser,
} from "../lib/neon";

const MEDIA_KINDS = ["movie", "series", "documentary", "show", "book", "podcast", "game"] as const;

interface ListWriteBody {
  id?: number;
  listId?: number;
  name?: string;
  itemId?: string;
  franchiseId?: number;
  visibility?: string;
}

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return neonJsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as ListWriteBody;
    if (body.franchiseId) {
      await addFranchise(connectionString, user.id, body);
    } else if (body.itemId) {
      await addListItem(connectionString, user.id, body);
    } else {
      await createList(connectionString, user.id, body.name);
    }

    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return neonJsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as ListWriteBody;
    await updateList(connectionString, user.id, body);
    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return neonJsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const url = new URL(request.url);
    if (url.searchParams.get("franchiseId")) {
      await removeFranchise(
        connectionString,
        user.id,
        Number(url.searchParams.get("listId") ?? url.searchParams.get("id")),
        Number(url.searchParams.get("franchiseId")),
      );
    } else if (url.searchParams.get("itemId")) {
      await removeListItem(connectionString, user.id, Number(url.searchParams.get("listId")), url.searchParams.get("itemId"));
    } else {
      await deleteList(connectionString, user.id, Number(url.searchParams.get("id")));
    }

    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return neonJsonError(error, { log: "User library request failed.", fallback: "Could not update your library.", unavailable: "Library unavailable." });
  }
}

async function loadLists(connectionString: string, userId: number) {
  const rows = await queryRows(
    connectionString,
    `SELECT l.id, l.name, l.visibility, i.media_kind, i.media_id
     FROM user_list l
     LEFT JOIN user_list_item i ON i.list_id = l.id
     WHERE l.user_id = $1
     ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id`,
    [userId],
  );

  const lists: { id: number; name: string; items: string[]; visibility: string }[] = [];
  const indexById = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.id);
    let index = indexById.get(id);
    if (index === undefined) {
      index = lists.length;
      indexById.set(id, index);
      lists.push({ id, name: String(row.name ?? ""), items: [], visibility: readVisibility(row.visibility) });
    }

    const kind = row.media_kind;
    const mediaId = row.media_id;
    if (kind == null || mediaId == null) {
      continue;
    }

    lists[index].items.push(`${String(kind)}:${Number(mediaId)}`);
  }

  return lists;
}

async function createList(connectionString: string, userId: number, name: string | undefined): Promise<void> {
  const trimmed = normalizeListName(name);
  const countRows = await queryRows(connectionString, "SELECT COUNT(*)::int AS count FROM user_list WHERE user_id = $1", [
    userId,
  ]);
  if (Number(countRows[0]?.count) >= 40) {
    throw new LibraryError("You already have 40 lists.", 400);
  }

  try {
    await execute(connectionString, "INSERT INTO user_list (user_id, name) VALUES ($1, $2)", [userId, trimmed]);
  } catch (error) {
    throw duplicateListError(error);
  }
}

async function updateList(connectionString: string, userId: number, body: ListWriteBody): Promise<void> {
  const id = requireListId(body.id ?? body.listId);
  const visibility = normalizeVisibility(body.visibility);
  if (!body.name && visibility) {
    const rows = await queryRows(
      connectionString,
      "UPDATE user_list SET visibility = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
      [visibility, id, userId],
    );
    if (rows.length < 1) {
      throw new LibraryError("That list was not found.", 400);
    }

    return;
  }

  const trimmed = normalizeListName(body.name);
  try {
    const rows = await queryRows(
      connectionString,
      visibility
        ? "UPDATE user_list SET name = $1, visibility = $2 WHERE id = $3 AND user_id = $4 RETURNING id"
        : "UPDATE user_list SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
      visibility ? [trimmed, visibility, id, userId] : [trimmed, id, userId],
    );
    if (rows.length < 1) {
      throw new LibraryError("That list was not found.", 400);
    }
  } catch (error) {
    throw duplicateListError(error);
  }
}

async function deleteList(connectionString: string, userId: number, listId: number): Promise<void> {
  const id = requireListId(listId);
  const rows = await queryRows(connectionString, "DELETE FROM user_list WHERE id = $1 AND user_id = $2 RETURNING id", [
    id,
    userId,
  ]);
  if (rows.length < 1) {
    throw new LibraryError("That list was not found.", 400);
  }
}

async function addListItem(connectionString: string, userId: number, body: ListWriteBody): Promise<void> {
  const listId = await requireOwnedList(connectionString, userId, body.listId ?? body.id);
  const { kind, mediaId } = parseCatalogId(body.itemId);
  const countRows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM user_list_item WHERE list_id = $1",
    [listId],
  );
  if (Number(countRows[0]?.count) >= 200) {
    throw new LibraryError("That list is full.", 400);
  }

  await execute(
    connectionString,
    `INSERT INTO user_list_item (list_id, media_kind, media_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (list_id, media_kind, media_id) DO NOTHING`,
    [listId, kind, mediaId],
  );
  if (kind === "series") {
    await addSeriesMovies(connectionString, listId, mediaId);
  }
}

async function removeListItem(
  connectionString: string,
  userId: number,
  listId: number,
  itemId: string | null,
): Promise<void> {
  const ownedListId = await requireOwnedList(connectionString, userId, listId);
  const { kind, mediaId } = parseCatalogId(itemId);
  await execute(
    connectionString,
    "DELETE FROM user_list_item WHERE list_id = $1 AND media_kind = $2 AND media_id = $3",
    [ownedListId, kind, mediaId],
  );
  if (kind === "series") {
    await removeSeriesMovies(connectionString, ownedListId, mediaId);
  }
}

async function addFranchise(connectionString: string, userId: number, body: ListWriteBody): Promise<void> {
  const listId = await requireOwnedList(connectionString, userId, body.listId ?? body.id);
  const franchiseId = requireFranchiseId(body.franchiseId);
  const countRows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM user_list_item WHERE list_id = $1",
    [listId],
  );
  if (Number(countRows[0]?.count) >= 200) {
    throw new LibraryError("That list is full.", 400);
  }

  const itemRows = await queryRows(
    connectionString,
    "SELECT COUNT(*)::int AS count FROM franchise_item WHERE franchise_id = $1",
    [franchiseId],
  );
  if (Number(itemRows[0]?.count) < 1) {
    throw new LibraryError("That franchise has nothing to add.", 400);
  }

  await execute(
    connectionString,
    `INSERT INTO user_list_item (list_id, media_kind, media_id)
     SELECT $1, media_kind, media_id
     FROM franchise_item
     WHERE franchise_id = $2
     ON CONFLICT (list_id, media_kind, media_id) DO NOTHING`,
    [listId, franchiseId],
  );
  const seriesRows = await queryRows(
    connectionString,
    "SELECT media_id FROM franchise_item WHERE franchise_id = $1 AND media_kind = 'series'",
    [franchiseId],
  );
  for (const row of seriesRows) {
    await addSeriesMovies(connectionString, listId, Number(row.media_id));
  }
}

async function removeFranchise(connectionString: string, userId: number, listId: number, franchiseId: number): Promise<void> {
  const ownedListId = await requireOwnedList(connectionString, userId, listId);
  const id = requireFranchiseId(franchiseId);
  const seriesRows = await queryRows(
    connectionString,
    "SELECT media_id FROM franchise_item WHERE franchise_id = $1 AND media_kind = 'series'",
    [id],
  );
  await execute(
    connectionString,
    `DELETE FROM user_list_item
     WHERE list_id = $1
       AND (media_kind, media_id) IN (
         SELECT media_kind, media_id
         FROM franchise_item
         WHERE franchise_id = $2
       )`,
    [ownedListId, id],
  );
  for (const row of seriesRows) {
    await removeSeriesMovies(connectionString, ownedListId, Number(row.media_id));
  }
}

function requireFranchiseId(id: number | undefined): number {
  if (!Number.isInteger(id) || Number(id) < 1) {
    throw new LibraryError("That franchise was not found.", 400);
  }

  return Number(id);
}

async function addSeriesMovies(connectionString: string, listId: number, seriesId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `INSERT INTO user_list_item (list_id, media_kind, media_id)
       SELECT $1, 'movie', id
       FROM movie
       WHERE seriesid = $2
       ON CONFLICT DO NOTHING`,
      [listId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function removeSeriesMovies(connectionString: string, listId: number, seriesId: number): Promise<void> {
  try {
    await execute(
      connectionString,
      `DELETE FROM user_list_item
       WHERE list_id = $1
         AND media_kind = 'movie'
         AND media_id IN (SELECT id FROM movie WHERE seriesid = $2)`,
      [listId, seriesId],
    );
  } catch {
    // Movie table or series links may not be available.
  }
}

async function requireOwnedList(connectionString: string, userId: number, listId: number | undefined): Promise<number> {
  const id = requireListId(listId);
  const rows = await queryRows(connectionString, "SELECT 1 FROM user_list WHERE id = $1 AND user_id = $2", [id, userId]);
  if (rows.length < 1) {
    throw new LibraryError("That list was not found.", 400);
  }

  return id;
}

function requireListId(id: number | undefined): number {
  if (!Number.isInteger(id) || Number(id) < 1) {
    throw new LibraryError("That list was not found.", 400);
  }

  return Number(id);
}

function normalizeListName(name: string | undefined): string {
  const value = (name ?? "").trim();
  if (value.length < 1 || value.length > 80) {
    throw new LibraryError("Enter a list name.", 400);
  }

  return value;
}

function duplicateListError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("user_list_user_name_idx") || message.includes("duplicate key")) {
    return new LibraryError("You already have a list with that name.", 400);
  }

  return error instanceof Error ? error : new Error("Could not save that list.");
}

class LibraryError extends HttpError {}

async function requireUser(request: Request, connectionString: string): Promise<SessionUser> {
  await ensureUserLibrarySchema(connectionString);
  return requireSessionUser(request, connectionString);
}

function readVisibility(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "public" ? "public" : "private";
}

function normalizeVisibility(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const visibility = value.trim().toLowerCase();
  if (visibility !== "private" && visibility !== "public") {
    throw new LibraryError("A list is either private or public.", 400);
  }

  return visibility;
}

function parseCatalogId(id: string | null | undefined): { kind: string; mediaId: number } {
  const parts = (id ?? "").split(":");
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new LibraryError("That title was not found.", 400);
  }

  const kind = parts[0].trim().toLowerCase();
  if (!MEDIA_KINDS.includes(kind as (typeof MEDIA_KINDS)[number])) {
    throw new LibraryError("That title was not found.", 400);
  }

  return { kind, mediaId };
}
