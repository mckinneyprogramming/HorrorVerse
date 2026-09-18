export const runtime = "nodejs";
export const maxDuration = 30;

import {
  execute,
  jsonError,
  LibraryError,
  parseCatalogId,
  queryRows,
  requireDatabaseUrl,
  requireUser,
} from "./_db";

interface ListWriteBody {
  id?: number;
  listId?: number;
  name?: string;
  itemId?: string;
}

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as ListWriteBody;
    if (body.itemId) {
      await addListItem(connectionString, user.id, body);
    } else {
      await createList(connectionString, user.id, body.name);
    }

    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as ListWriteBody;
    await renameList(connectionString, user.id, body.id ?? body.listId, body.name);
    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const url = new URL(request.url);
    if (url.searchParams.get("itemId")) {
      await removeListItem(connectionString, user.id, Number(url.searchParams.get("listId")), url.searchParams.get("itemId"));
    } else {
      await deleteList(connectionString, user.id, Number(url.searchParams.get("id")));
    }

    return Response.json({ lists: await loadLists(connectionString, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

async function loadLists(connectionString: string, userId: number) {
  const rows = await queryRows(
    connectionString,
    `SELECT l.id, l.name, i.media_kind, i.media_id
     FROM user_list l
     LEFT JOIN user_list_item i ON i.list_id = l.id
     WHERE l.user_id = $1
     ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id`,
    [userId],
  );

  const lists: { id: number; name: string; items: string[] }[] = [];
  const indexById = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.id);
    let index = indexById.get(id);
    if (index === undefined) {
      index = lists.length;
      indexById.set(id, index);
      lists.push({ id, name: String(row.name ?? ""), items: [] });
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

async function renameList(
  connectionString: string,
  userId: number,
  listId: number | undefined,
  name: string | undefined,
): Promise<void> {
  const id = requireListId(listId);
  const trimmed = normalizeListName(name);
  try {
    const rows = await queryRows(
      connectionString,
      "UPDATE user_list SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
      [trimmed, id, userId],
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
