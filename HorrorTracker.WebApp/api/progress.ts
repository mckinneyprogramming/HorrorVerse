export const runtime = "nodejs";
export const maxDuration = 30;

import {
  execute,
  jsonError,
  parseCatalogId,
  queryRows,
  requireDatabaseUrl,
  requireUser,
  type SessionUser,
} from "./_db";

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    return Response.json({ ids: await loadCompletedIds(connectionString, user) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as { id?: string; completed?: boolean };
    const { kind, mediaId } = parseCatalogId(body.id);
    if (body.completed) {
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, media_kind, media_id)
         DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [user.id, kind, mediaId],
      );
    } else {
      await execute(
        connectionString,
        "DELETE FROM user_media_progress WHERE user_id = $1 AND media_kind = $2 AND media_id = $3",
        [user.id, kind, mediaId],
      );
    }

    return Response.json({ ids: await loadCompletedIds(connectionString, user) });
  } catch (error) {
    return jsonError(error);
  }
}

async function loadCompletedIds(connectionString: string, user: SessionUser): Promise<string[]> {
  await seedAdminProgressIfNeeded(connectionString, user);
  const rows = await queryRows(
    connectionString,
    "SELECT media_kind, media_id FROM user_media_progress WHERE user_id = $1",
    [user.id],
  );
  return rows.map((row) => `${String(row.media_kind)}:${Number(row.media_id)}`);
}

async function seedAdminProgressIfNeeded(connectionString: string, user: SessionUser): Promise<void> {
  if (!user.isAdmin) {
    return;
  }

  const seeded = await queryRows(connectionString, "SELECT 1 FROM user_progress_seed WHERE user_id = $1", [user.id]);
  if (seeded.length > 0) {
    return;
  }

  const copies = [
    ["movie", "SELECT $1, 'movie', id FROM movie WHERE watched"],
    ["series", "SELECT $1, 'series', id FROM movieseries WHERE watched"],
    ["documentary", "SELECT $1, 'documentary', id FROM documentary WHERE watched"],
    ["show", "SELECT $1, 'show', id FROM show WHERE watched"],
    ["book", "SELECT $1, 'book', id FROM book WHERE read"],
  ] as const;

  for (const [, selectSql] of copies) {
    try {
      await execute(
        connectionString,
        `INSERT INTO user_media_progress (user_id, media_kind, media_id)
         ${selectSql}
         ON CONFLICT DO NOTHING`,
        [user.id],
      );
    } catch {
      // Optional catalog tables may not exist yet.
    }
  }

  await execute(
    connectionString,
    "INSERT INTO user_progress_seed (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    [user.id],
  );
}
