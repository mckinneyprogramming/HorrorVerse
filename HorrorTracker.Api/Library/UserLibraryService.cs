using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using Npgsql;

namespace HorrorTracker.Api.Library;

public sealed class UserLibraryService(IConfiguration configuration)
{
    private static readonly HashSet<string> MediaKinds =
    [
        "movie",
        "series",
        "documentary",
        "show",
        "book",
        "podcast",
        "game"
    ];

    public IReadOnlyList<string> GetCompletedIds(AuthUserDto user)
    {
        EnsureSchema();
        SeedAdminProgressIfEmpty(user);
        return GetCompletedIds(user.Id);
    }

    public IReadOnlyList<string> GetCompletedIds(int userId)
    {
        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT media_kind, media_id
            FROM user_media_progress
            WHERE user_id = @userId
            """;
        command.Parameters.AddWithValue("userId", userId);
        using var reader = command.ExecuteReader();
        var ids = new List<string>();
        while (reader.Read())
        {
            ids.Add($"{reader.GetString(0)}:{reader.GetInt32(1)}");
        }

        return ids;
    }

    public IReadOnlyList<string> SetCompleted(AuthUserDto user, ProgressWriteRequest request)
    {
        EnsureSchema();
        var (kind, mediaId) = ParseCatalogId(request.Id);

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        if (request.Completed)
        {
            command.CommandText = """
                INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
                VALUES (@userId, @kind, @mediaId, NOW())
                ON CONFLICT (user_id, media_kind, media_id)
                DO UPDATE SET completed_at = EXCLUDED.completed_at
                """;
        }
        else
        {
            command.CommandText = """
                DELETE FROM user_media_progress
                WHERE user_id = @userId AND media_kind = @kind AND media_id = @mediaId
                """;
        }

        command.Parameters.AddWithValue("userId", user.Id);
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("mediaId", mediaId);
        command.ExecuteNonQuery();
        if (kind == "series")
        {
            CascadeSeriesMovies(user.Id, mediaId, request.Completed);
        }
        else if (kind == "movie")
        {
            SyncSeriesForMovie(user.Id, mediaId);
        }

        return GetCompletedIds(user);
    }

    public IReadOnlyList<UserListDto> GetLists(AuthUserDto user) =>
        GetPublicLists(user.Id, includePrivate: true);

    public IReadOnlyList<UserListDto> GetPublicLists(int ownerId, bool includePrivate)
    {
        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = includePrivate
            ? """
                SELECT l.id, l.name, l.visibility, i.media_kind, i.media_id
                FROM user_list l
                LEFT JOIN user_list_item i ON i.list_id = l.id
                WHERE l.user_id = @userId
                ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id
                """
            : """
                SELECT l.id, l.name, l.visibility, i.media_kind, i.media_id
                FROM user_list l
                LEFT JOIN user_list_item i ON i.list_id = l.id
                WHERE l.user_id = @userId AND l.visibility = 'public'
                ORDER BY lower(l.name), l.id, i.added_at, i.media_kind, i.media_id
                """;
        command.Parameters.AddWithValue("userId", ownerId);
        using var reader = command.ExecuteReader();
        return ReadLists(reader);
    }

    private static IReadOnlyList<UserListDto> ReadLists(NpgsqlDataReader reader)
    {
        var lists = new List<UserListDto>();
        var indexById = new Dictionary<int, int>();
        while (reader.Read())
        {
            var id = reader.GetInt32(0);
            if (!indexById.TryGetValue(id, out var index))
            {
                index = lists.Count;
                indexById[id] = index;
                lists.Add(new UserListDto(id, reader.GetString(1), [], ReadVisibility(reader, 2)));
            }

            if (reader.IsDBNull(3) || reader.IsDBNull(4))
            {
                continue;
            }

            var items = lists[index].Items.ToList();
            items.Add($"{reader.GetString(3)}:{reader.GetInt32(4)}");
            lists[index] = lists[index] with { Items = items };
        }

        return lists;
    }

    public IReadOnlyList<UserListDto> CreateList(AuthUserDto user, ListWriteRequest request)
    {
        EnsureSchema();
        EnsureListLimit(user.Id);
        var name = NormalizeListName(request.Name);

        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO user_list (user_id, name)
                VALUES (@userId, @name)
                """;
            command.Parameters.AddWithValue("userId", user.Id);
            command.Parameters.AddWithValue("name", name);
            command.ExecuteNonQuery();
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            throw new InvalidOperationException("You already have a list with that name.");
        }

        return GetLists(user);
    }

    public IReadOnlyList<UserListDto> RenameList(AuthUserDto user, ListWriteRequest request)
    {
        EnsureSchema();
        var listId = RequireListId(request.Id ?? request.ListId);
        var visibility = NormalizeVisibility(request.Visibility);
        if (string.IsNullOrWhiteSpace(request.Name) && visibility is not null)
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                UPDATE user_list
                SET visibility = @visibility
                WHERE id = @id AND user_id = @userId
                """;
            command.Parameters.AddWithValue("visibility", visibility);
            command.Parameters.AddWithValue("id", listId);
            command.Parameters.AddWithValue("userId", user.Id);
            if (command.ExecuteNonQuery() < 1)
            {
                throw new InvalidOperationException("That list was not found.");
            }

            return GetLists(user);
        }

        var name = NormalizeListName(request.Name);

        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = visibility is null
                ? """
                    UPDATE user_list
                    SET name = @name
                    WHERE id = @id AND user_id = @userId
                    """
                : """
                    UPDATE user_list
                    SET name = @name, visibility = @visibility
                    WHERE id = @id AND user_id = @userId
                    """;
            command.Parameters.AddWithValue("name", name);
            command.Parameters.AddWithValue("id", listId);
            command.Parameters.AddWithValue("userId", user.Id);
            if (visibility is not null)
            {
                command.Parameters.AddWithValue("visibility", visibility);
            }

            if (command.ExecuteNonQuery() < 1)
            {
                throw new InvalidOperationException("That list was not found.");
            }
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            throw new InvalidOperationException("You already have a list with that name.");
        }

        return GetLists(user);
    }

    public IReadOnlyList<UserListDto> DeleteList(AuthUserDto user, int? id)
    {
        EnsureSchema();
        var listId = RequireListId(id);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM user_list WHERE id = @id AND user_id = @userId";
        command.Parameters.AddWithValue("id", listId);
        command.Parameters.AddWithValue("userId", user.Id);
        if (command.ExecuteNonQuery() < 1)
        {
            throw new InvalidOperationException("That list was not found.");
        }

        return GetLists(user);
    }

    public IReadOnlyList<UserListDto> AddListItem(AuthUserDto user, ListWriteRequest request)
    {
        EnsureSchema();
        var listId = RequireOwnedList(user.Id, request.ListId ?? request.Id);
        var (kind, mediaId) = ParseCatalogId(request.ItemId);
        EnsureItemLimit(listId);

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO user_list_item (list_id, media_kind, media_id)
            VALUES (@listId, @kind, @mediaId)
            ON CONFLICT (list_id, media_kind, media_id) DO NOTHING
            """;
        command.Parameters.AddWithValue("listId", listId);
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("mediaId", mediaId);
        command.ExecuteNonQuery();
        if (kind == "series")
        {
            AddSeriesMovies(listId, mediaId);
        }

        return GetLists(user);
    }

    public IReadOnlyList<UserListDto> RemoveListItem(AuthUserDto user, int? listId, string? itemId)
    {
        EnsureSchema();
        var ownedListId = RequireOwnedList(user.Id, listId);
        var (kind, mediaId) = ParseCatalogId(itemId);

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM user_list_item
            WHERE list_id = @listId AND media_kind = @kind AND media_id = @mediaId
            """;
        command.Parameters.AddWithValue("listId", ownedListId);
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("mediaId", mediaId);
        command.ExecuteNonQuery();
        if (kind == "series")
        {
            RemoveSeriesMovies(ownedListId, mediaId);
        }

        return GetLists(user);
    }

    public IReadOnlyList<UserListDto> AddFranchise(AuthUserDto user, ListWriteRequest request)
    {
        EnsureSchema();
        var listId = RequireOwnedList(user.Id, request.ListId ?? request.Id);
        var franchiseId = RequireFranchiseId(request.FranchiseId);
        EnsureItemLimit(listId);
        var seriesIds = FranchiseSeriesIds(franchiseId);
        if (FranchiseItemCount(franchiseId) < 1)
        {
            throw new InvalidOperationException("That franchise has nothing to add.");
        }

        using (var connection = OpenConnection())
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                INSERT INTO user_list_item (list_id, media_kind, media_id)
                SELECT @listId, media_kind, media_id
                FROM franchise_item
                WHERE franchise_id = @franchiseId
                ON CONFLICT (list_id, media_kind, media_id) DO NOTHING
                """;
            command.Parameters.AddWithValue("listId", listId);
            command.Parameters.AddWithValue("franchiseId", franchiseId);
            command.ExecuteNonQuery();
        }

        foreach (var seriesId in seriesIds)
        {
            AddSeriesMovies(listId, seriesId);
        }

        return GetLists(user);
    }

    public IReadOnlyList<UserListDto> RemoveFranchise(AuthUserDto user, int? listId, int? franchiseId)
    {
        EnsureSchema();
        var ownedListId = RequireOwnedList(user.Id, listId);
        var id = RequireFranchiseId(franchiseId);
        var seriesIds = FranchiseSeriesIds(id);

        using (var connection = OpenConnection())
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                DELETE FROM user_list_item
                WHERE list_id = @listId
                  AND (media_kind, media_id) IN (
                    SELECT media_kind, media_id
                    FROM franchise_item
                    WHERE franchise_id = @franchiseId
                  )
                """;
            command.Parameters.AddWithValue("listId", ownedListId);
            command.Parameters.AddWithValue("franchiseId", id);
            command.ExecuteNonQuery();
        }

        foreach (var seriesId in seriesIds)
        {
            RemoveSeriesMovies(ownedListId, seriesId);
        }

        return GetLists(user);
    }

    public void PurgeMedia(string? id)
    {
        EnsureSchema();
        var (kind, mediaId) = ParseCatalogId(id);
        using var connection = OpenConnection();
        using (var progress = connection.CreateCommand())
        {
            progress.CommandText = """
                DELETE FROM user_media_progress
                WHERE media_kind = @kind AND media_id = @mediaId
                """;
            progress.Parameters.AddWithValue("kind", kind);
            progress.Parameters.AddWithValue("mediaId", mediaId);
            progress.ExecuteNonQuery();
        }

        using var items = connection.CreateCommand();
        items.CommandText = """
            DELETE FROM user_list_item
            WHERE media_kind = @kind AND media_id = @mediaId
            """;
        items.Parameters.AddWithValue("kind", kind);
        items.Parameters.AddWithValue("mediaId", mediaId);
        items.ExecuteNonQuery();
    }

    private void SeedAdminProgressIfEmpty(AuthUserDto user)
    {
        if (!user.IsAdmin)
        {
            return;
        }

        using var connection = OpenConnection();
        using (var seedCommand = connection.CreateCommand())
        {
            seedCommand.CommandText = "SELECT 1 FROM user_progress_seed WHERE user_id = @userId";
            seedCommand.Parameters.AddWithValue("userId", user.Id);
            if (seedCommand.ExecuteScalar() is not null)
            {
                return;
            }
        }

        foreach (var sql in new[]
        {
            """
            INSERT INTO user_media_progress (user_id, media_kind, media_id)
            SELECT @userId, 'movie', id FROM movie WHERE watched
            ON CONFLICT DO NOTHING
            """,
            """
            INSERT INTO user_media_progress (user_id, media_kind, media_id)
            SELECT @userId, 'series', id FROM movieseries WHERE watched
            ON CONFLICT DO NOTHING
            """,
            """
            INSERT INTO user_media_progress (user_id, media_kind, media_id)
            SELECT @userId, 'documentary', id FROM documentary WHERE watched
            ON CONFLICT DO NOTHING
            """,
            """
            INSERT INTO user_media_progress (user_id, media_kind, media_id)
            SELECT @userId, 'show', id FROM show WHERE watched
            ON CONFLICT DO NOTHING
            """,
            """
            INSERT INTO user_media_progress (user_id, media_kind, media_id)
            SELECT @userId, 'book', id FROM book WHERE read
            ON CONFLICT DO NOTHING
            """
        })
        {
            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = sql;
                command.Parameters.AddWithValue("userId", user.Id);
                command.ExecuteNonQuery();
            }
            catch (PostgresException)
            {
                // Optional catalog tables may not exist yet.
            }
        }

        using var markSeeded = connection.CreateCommand();
        markSeeded.CommandText = """
            INSERT INTO user_progress_seed (user_id)
            VALUES (@userId)
            ON CONFLICT (user_id) DO NOTHING
            """;
        markSeeded.Parameters.AddWithValue("userId", user.Id);
        markSeeded.ExecuteNonQuery();
    }

    private void EnsureSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS user_media_progress (
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, media_kind, media_id)
            );
            CREATE TABLE IF NOT EXISTS user_list (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS user_list_user_id_idx ON user_list (user_id);
            CREATE UNIQUE INDEX IF NOT EXISTS user_list_user_name_idx ON user_list (user_id, lower(name));
            CREATE TABLE IF NOT EXISTS user_list_item (
                list_id INTEGER NOT NULL REFERENCES user_list(id) ON DELETE CASCADE,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (list_id, media_kind, media_id)
            );
            CREATE TABLE IF NOT EXISTS user_progress_seed (
                user_id INTEGER PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
                seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            ALTER TABLE user_list ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
            """;
        command.ExecuteNonQuery();
    }

    private int RequireOwnedList(int userId, int? listId)
    {
        var id = RequireListId(listId);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM user_list WHERE id = @id AND user_id = @userId";
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("userId", userId);
        if (command.ExecuteScalar() is null)
        {
            throw new InvalidOperationException("That list was not found.");
        }

        return id;
    }

    private static int RequireFranchiseId(int? id)
    {
        if (id is null or < 1)
        {
            throw new InvalidOperationException("That franchise was not found.");
        }

        return id.Value;
    }

    private int FranchiseItemCount(int franchiseId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM franchise_item WHERE franchise_id = @id";
            command.Parameters.AddWithValue("id", franchiseId);
            return Convert.ToInt32(command.ExecuteScalar());
        }
        catch (PostgresException)
        {
            throw new InvalidOperationException("That franchise was not found.");
        }
    }

    private IReadOnlyList<int> FranchiseSeriesIds(int franchiseId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT media_id
                FROM franchise_item
                WHERE franchise_id = @id AND media_kind = 'series'
                """;
            command.Parameters.AddWithValue("id", franchiseId);
            var ids = new List<int>();
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                ids.Add(reader.GetInt32(0));
            }

            return ids;
        }
        catch (PostgresException)
        {
            throw new InvalidOperationException("That franchise was not found.");
        }
    }

    private void CascadeSeriesMovies(int userId, int seriesId, bool completed)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = completed
                ? """
                    INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
                    SELECT @userId, 'movie', id, NOW()
                    FROM movie
                    WHERE seriesid = @seriesId
                    ON CONFLICT (user_id, media_kind, media_id)
                    DO UPDATE SET completed_at = EXCLUDED.completed_at
                    """
                : """
                    DELETE FROM user_media_progress
                    WHERE user_id = @userId
                      AND media_kind = 'movie'
                      AND media_id IN (SELECT id FROM movie WHERE seriesid = @seriesId)
                    """;
            command.Parameters.AddWithValue("userId", userId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void SyncSeriesForMovie(int userId, int movieId)
    {
        try
        {
            using var connection = OpenConnection();
            int? seriesId;
            using (var lookup = connection.CreateCommand())
            {
                lookup.CommandText = "SELECT seriesid FROM movie WHERE id = @movieId";
                lookup.Parameters.AddWithValue("movieId", movieId);
                var value = lookup.ExecuteScalar();
                seriesId = value is null or DBNull ? null : Convert.ToInt32(value) is int id && id > 0 ? id : null;
            }

            if (seriesId is not int resolved)
            {
                return;
            }

            using var totals = connection.CreateCommand();
            totals.CommandText = """
                SELECT
                    (SELECT COUNT(*) FROM movie WHERE seriesid = @seriesId) AS total,
                    (SELECT COUNT(*) FROM user_media_progress p
                     JOIN movie m ON m.id = p.media_id
                     WHERE p.user_id = @userId AND p.media_kind = 'movie' AND m.seriesid = @seriesId) AS finished
                """;
            totals.Parameters.AddWithValue("seriesId", resolved);
            totals.Parameters.AddWithValue("userId", userId);
            using var reader = totals.ExecuteReader();
            if (!reader.Read())
            {
                return;
            }

            var total = Convert.ToInt32(reader.GetInt64(0));
            var finished = Convert.ToInt32(reader.GetInt64(1));
            reader.Close();
            using var progress = connection.CreateCommand();
            progress.CommandText = total > 0 && finished >= total
                ? """
                    INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
                    VALUES (@userId, 'series', @seriesId, NOW())
                    ON CONFLICT (user_id, media_kind, media_id)
                    DO UPDATE SET completed_at = EXCLUDED.completed_at
                    """
                : """
                    DELETE FROM user_media_progress
                    WHERE user_id = @userId AND media_kind = 'series' AND media_id = @seriesId
                    """;
            progress.Parameters.AddWithValue("userId", userId);
            progress.Parameters.AddWithValue("seriesId", resolved);
            progress.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void AddSeriesMovies(int listId, int seriesId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO user_list_item (list_id, media_kind, media_id)
                SELECT @listId, 'movie', id
                FROM movie
                WHERE seriesid = @seriesId
                ON CONFLICT DO NOTHING
                """;
            command.Parameters.AddWithValue("listId", listId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void RemoveSeriesMovies(int listId, int seriesId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                DELETE FROM user_list_item
                WHERE list_id = @listId
                  AND media_kind = 'movie'
                  AND media_id IN (SELECT id FROM movie WHERE seriesid = @seriesId)
                """;
            command.Parameters.AddWithValue("listId", listId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void EnsureListLimit(int userId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM user_list WHERE user_id = @userId";
        command.Parameters.AddWithValue("userId", userId);
        if (Convert.ToInt64(command.ExecuteScalar()) >= 40)
        {
            throw new InvalidOperationException("You already have 40 lists.");
        }
    }

    private void EnsureItemLimit(int listId) =>
        CatalogDb.EnsureCountAtMost(
            configuration,
            "SELECT COUNT(*) FROM user_list_item WHERE list_id = @id",
            listId,
            200,
            "That list is full.");

    private NpgsqlConnection OpenConnection() => CatalogDb.Open(configuration);

    private static (string Kind, int MediaId) ParseCatalogId(string? id)
    {
        var parts = (id ?? string.Empty).Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[1], out var mediaId) || mediaId < 1)
        {
            throw new InvalidOperationException("That title was not found.");
        }

        var kind = parts[0].ToLowerInvariant();
        if (!MediaKinds.Contains(kind))
        {
            throw new InvalidOperationException("That title was not found.");
        }

        return (kind, mediaId);
    }

    private static int RequireListId(int? id)
    {
        if (id is null or < 1)
        {
            throw new InvalidOperationException("That list was not found.");
        }

        return id.Value;
    }

    private static string NormalizeListName(string? name)
    {
        var value = (name ?? string.Empty).Trim();
        if (value.Length is < 1 or > 80)
        {
            throw new InvalidOperationException("Enter a list name.");
        }

        return value;
    }

    private static string? NormalizeVisibility(string? visibility)
    {
        if (string.IsNullOrWhiteSpace(visibility))
        {
            return null;
        }

        var value = visibility.Trim().ToLowerInvariant();
        if (value is not ("private" or "public"))
        {
            throw new InvalidOperationException("A list is either private or public.");
        }

        return value;
    }

    private static string ReadVisibility(NpgsqlDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
        {
            return "private";
        }

        var value = reader.GetString(ordinal).Trim().ToLowerInvariant();
        return value == "public" ? "public" : "private";
    }
}
