using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using Npgsql;

namespace HorrorTracker.Api.Library;

public sealed class UserLibraryService(IConfiguration configuration, TmdbCatalogService tmdb)
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

    public object GetProgress(AuthUserDto user)
    {
        EnsureSchema();
        SeedAdminProgressIfEmpty(user);
        return LoadProgress(user.Id);
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

    private object LoadProgress(int userId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT media_kind, media_id, completed_at
            FROM user_media_progress
            WHERE user_id = @userId
            """;
        command.Parameters.AddWithValue("userId", userId);
        using var reader = command.ExecuteReader();
        var ids = new List<string>();
        var undatedIds = new List<string>();
        var dated = new List<(string Id, DateTimeOffset At)>();
        var watchedYears = new Dictionary<string, int>();
        while (reader.Read())
        {
            var id = $"{reader.GetString(0)}:{reader.GetInt32(1)}";
            ids.Add(id);
            if (reader.IsDBNull(2))
            {
                undatedIds.Add(id);
                continue;
            }

            var completedAt = reader.GetFieldValue<DateTimeOffset>(2);
            dated.Add((id, completedAt));
            watchedYears[id] = completedAt.UtcDateTime.Year;
        }

        var recentIds = dated.OrderByDescending(item => item.At).ThenBy(item => item.Id).Take(8).Select(item => item.Id).ToList();
        var watchNext = LoadWatchNextSafe(userId);
        var homeIds = recentIds.Concat(watchNext.Select(item => item.Id)).Distinct(StringComparer.Ordinal).ToList();
        Dictionary<string, string> homePosters;
        try
        {
            homePosters = tmdb.PostersForRecentAsync(homeIds, CancellationToken.None).GetAwaiter().GetResult();
        }
        catch
        {
            homePosters = [];
        }

        return new
        {
            ids,
            recentIds,
            undatedIds,
            watchedYears,
            recentPosters = recentIds.Where(homePosters.ContainsKey).ToDictionary(id => id, id => homePosters[id]),
            watchNext = watchNext.Select(item => (object)new
            {
                id = item.Id,
                title = item.Title,
                kind = item.Kind,
                reason = item.Reason,
                detail = item.Detail,
                posterPath = item.PosterPath ?? (homePosters.TryGetValue(item.Id, out var path) ? path : null)
            }).ToList()
        };
    }

    private List<WatchNextPick> LoadWatchNextSafe(int userId)
    {
        try
        {
            return LoadWatchNext(userId);
        }
        catch
        {
            return [];
        }
    }

    private List<WatchNextPick> LoadWatchNext(int userId)
    {
        var picked = new List<WatchNextPick>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        void Add(IEnumerable<WatchNextPick> items)
        {
            foreach (var item in items)
            {
                if (picked.Count >= 6 || !seen.Add(item.Id))
                {
                    continue;
                }

                picked.Add(item);
            }
        }

        Add(LoadNextEpisodes(userId));
        Add(LoadNextSeriesMovies(userId));
        Add(LoadListedUnfinished(userId));
        Add(ShuffleWatchNext(LoadVaultUnfinished(userId), userId));
        return picked;
    }

    private List<WatchNextPick> LoadNextEpisodes(int userId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT DISTINCT ON (s.id)
                    s.id, s.title, s.posterpath, se.season_number, e.episode_number, e.title,
                    (SELECT MAX(p.completed_at)
                     FROM user_episode_progress p
                     JOIN show_episode pe ON pe.id = p.episode_id
                     WHERE p.user_id = @userId AND pe.show_id = s.id) AS last_watched
                FROM show s
                JOIN show_episode e ON e.show_id = s.id
                JOIN show_season se ON se.id = e.season_id
                WHERE EXISTS (
                    SELECT 1 FROM user_episode_progress p
                    JOIN show_episode pe ON pe.id = p.episode_id
                    WHERE p.user_id = @userId AND pe.show_id = s.id)
                  AND NOT EXISTS (
                    SELECT 1 FROM user_media_progress ump
                    WHERE ump.user_id = @userId AND ump.media_kind = 'show' AND ump.media_id = s.id)
                  AND NOT EXISTS (
                    SELECT 1 FROM user_episode_progress p2
                    WHERE p2.user_id = @userId AND p2.episode_id = e.id)
                ORDER BY s.id, se.season_number, e.episode_number
                """;
            command.Parameters.AddWithValue("userId", userId);
            using var reader = command.ExecuteReader();
            var rows = new List<(DateTimeOffset At, WatchNextPick Item)>();
            while (reader.Read())
            {
                var season = reader.GetInt32(3);
                var number = reader.GetInt32(4);
                var episodeTitle = reader.GetString(5);
                var seasonLabel = season == 0 ? "Specials" : $"S{season}";
                var detail = string.IsNullOrWhiteSpace(episodeTitle) ? $"{seasonLabel} E{number}" : $"{seasonLabel} E{number} · {episodeTitle}";
                var at = reader.IsDBNull(6) ? DateTimeOffset.MinValue : reader.GetFieldValue<DateTimeOffset>(6);
                var item = WatchNextItem("show", reader.GetInt32(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2), "episode", detail);
                if (item is not null)
                {
                    rows.Add((at, item));
                }
            }

            return rows.OrderByDescending(row => row.At).Select(row => row.Item).ToList();
        }
        catch (PostgresException)
        {
            return [];
        }
    }

    private List<WatchNextPick> LoadNextSeriesMovies(int userId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT DISTINCT ON (m.seriesid)
                    m.id, m.title, COALESCE(NULLIF(m.posterpath, '-'), NULLIF(ms.posterpath, '-')) AS posterpath, m.releaseyear, ms.title,
                    (SELECT MAX(p.completed_at)
                     FROM user_media_progress p
                     JOIN movie fm ON fm.id = p.media_id
                     WHERE p.user_id = @userId AND p.media_kind = 'movie' AND fm.seriesid = m.seriesid) AS last_watched
                FROM movie m
                JOIN movieseries ms ON ms.id = m.seriesid
                WHERE m.seriesid IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM user_media_progress p
                    JOIN movie fm ON fm.id = p.media_id
                    WHERE p.user_id = @userId AND p.media_kind = 'movie' AND fm.seriesid = m.seriesid)
                  AND NOT EXISTS (
                    SELECT 1 FROM user_media_progress p
                    WHERE p.user_id = @userId AND p.media_kind = 'movie' AND p.media_id = m.id)
                ORDER BY m.seriesid, m.releaseyear NULLS LAST, m.title
                """;
            command.Parameters.AddWithValue("userId", userId);
            using var reader = command.ExecuteReader();
            var rows = new List<(DateTimeOffset At, WatchNextPick Item)>();
            while (reader.Read())
            {
                var year = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3);
                var seriesTitle = reader.GetString(4);
                var detail = string.Join(" · ", new[] { seriesTitle, year is int value && value > 0 ? value.ToString() : null }.Where(part => !string.IsNullOrWhiteSpace(part)));
                var at = reader.IsDBNull(5) ? DateTimeOffset.MinValue : reader.GetFieldValue<DateTimeOffset>(5);
                var item = WatchNextItem("movie", reader.GetInt32(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2), "series", detail);
                if (item is not null)
                {
                    rows.Add((at, item));
                }
            }

            return rows.OrderByDescending(row => row.At).Select(row => row.Item).ToList();
        }
        catch (PostgresException)
        {
            return [];
        }
    }

    private List<WatchNextPick> LoadListedUnfinished(int userId) =>
        ReadWatchNextRows(
            userId,
            """
            SELECT 'movie' AS kind, m.id, m.title, m.posterpath, m.releaseyear
            FROM user_list_item i
            JOIN user_list l ON l.id = i.list_id
            JOIN movie m ON m.id = i.media_id
            WHERE l.user_id = @userId AND i.media_kind = 'movie'
              AND NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'movie' AND p.media_id = m.id)
            UNION ALL
            SELECT 'documentary', d.id, d.title, d.posterpath, d.releaseyear
            FROM user_list_item i
            JOIN user_list l ON l.id = i.list_id
            JOIN documentary d ON d.id = i.media_id
            WHERE l.user_id = @userId AND i.media_kind = 'documentary'
              AND NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'documentary' AND p.media_id = d.id)
            UNION ALL
            SELECT 'show', s.id, s.title, s.posterpath, s.releaseyear
            FROM user_list_item i
            JOIN user_list l ON l.id = i.list_id
            JOIN show s ON s.id = i.media_id
            WHERE l.user_id = @userId AND i.media_kind = 'show'
              AND NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'show' AND p.media_id = s.id)
            UNION ALL
            SELECT 'book', b.id, b.title, NULL, b.releaseyear
            FROM user_list_item i
            JOIN user_list l ON l.id = i.list_id
            JOIN book b ON b.id = i.media_id
            WHERE l.user_id = @userId AND i.media_kind = 'book'
              AND NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'book' AND p.media_id = b.id)
            """,
            "list");

    private List<WatchNextPick> LoadVaultUnfinished(int userId) =>
        ReadWatchNextRows(
            userId,
            """
            (
              SELECT 'movie' AS kind, id, title, posterpath, releaseyear FROM movie m
              WHERE NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'movie' AND p.media_id = m.id)
              ORDER BY id
              LIMIT 20
            )
            UNION ALL
            (
              SELECT 'documentary', id, title, posterpath, releaseyear FROM documentary d
              WHERE NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'documentary' AND p.media_id = d.id)
              ORDER BY id
              LIMIT 20
            )
            UNION ALL
            (
              SELECT 'show', id, title, posterpath, releaseyear FROM show s
              WHERE NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'show' AND p.media_id = s.id)
              ORDER BY id
              LIMIT 20
            )
            UNION ALL
            (
              SELECT 'book', id, title, NULL, releaseyear FROM book b
              WHERE NOT EXISTS (SELECT 1 FROM user_media_progress p WHERE p.user_id = @userId AND p.media_kind = 'book' AND p.media_id = b.id)
              ORDER BY id
              LIMIT 20
            )
            """,
            "vault");

    private List<WatchNextPick> ReadWatchNextRows(int userId, string sql, string reason)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.Parameters.AddWithValue("userId", userId);
            using var reader = command.ExecuteReader();
            var items = new List<WatchNextPick>();
            while (reader.Read())
            {
                var year = reader.IsDBNull(4) ? (int?)null : Convert.ToInt32(reader.GetValue(4));
                var item = WatchNextItem(
                    reader.GetString(0),
                    Convert.ToInt32(reader.GetValue(1)),
                    reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reason,
                    year is int value && value > 0 ? value.ToString() : null);
                if (item is not null)
                {
                    items.Add(item);
                }
            }

            return items;
        }
        catch (PostgresException)
        {
            return [];
        }
    }

    private static List<WatchNextPick> ShuffleWatchNext(List<WatchNextPick> items, int userId)
    {
        var seed = (uint)(userId * 10_000 + DateTime.UtcNow.Year * 400 + DateTime.UtcNow.Month * 32 + DateTime.UtcNow.Day);
        if (seed == 0)
        {
            seed = 1;
        }

        for (var index = items.Count - 1; index > 0; index--)
        {
            seed = unchecked(seed * 1664525u + 1013904223u);
            var swap = (int)(seed % (uint)(index + 1));
            (items[index], items[swap]) = (items[swap], items[index]);
        }

        return items;
    }

    private static WatchNextPick? WatchNextItem(string kind, int mediaId, string title, string? posterPath, string reason, string? detail)
    {
        var name = title.Trim();
        if (mediaId < 1 || name.Length < 1)
        {
            return null;
        }

        var path = (posterPath ?? string.Empty).Trim();
        var poster = path.StartsWith('/') && path.Length <= 160 && !path.Contains("..", StringComparison.Ordinal) ? path : null;
        return new WatchNextPick($"{kind}:{mediaId}", name, kind, reason, string.IsNullOrWhiteSpace(detail) ? null : detail, poster);
    }

    private sealed record WatchNextPick(string Id, string Title, string Kind, string Reason, string? Detail, string? PosterPath);

    private static int? ParseWatchYear(int? year)
    {
        var last = DateTime.UtcNow.Year + 1;
        return year is >= 1888 && year <= last ? year : null;
    }

    private static void AddCompletedAt(NpgsqlCommand command, bool dated, int? year)
    {
        command.Parameters.AddWithValue("dated", dated);
        command.Parameters.AddWithValue("completedAt", year is int value
            ? new DateTime(value, 7, 1, 12, 0, 0, DateTimeKind.Utc)
            : DBNull.Value);
    }

    public object SetCompleted(AuthUserDto user, ProgressWriteRequest request)
    {
        EnsureSchema();
        var (kind, mediaId) = ParseCatalogId(request.Id);
        var year = request.Dated ? ParseWatchYear(request.Year) : null;

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        if (request.Completed)
        {
            command.CommandText = """
                INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
                VALUES (@userId, @kind, @mediaId, CASE WHEN @dated THEN COALESCE(@completedAt, NOW()) ELSE NULL END)
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
        AddCompletedAt(command, request.Dated, year);
        command.ExecuteNonQuery();
        if (kind == "series")
        {
            CascadeSeriesMovies(user.Id, mediaId, request.Completed, request.Dated, year);
        }
        else if (kind == "movie")
        {
            SyncSeriesForMovie(user.Id, mediaId, request.Dated, year);
        }

        return LoadProgress(user.Id);
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
            ALTER TABLE user_media_progress ALTER COLUMN completed_at DROP NOT NULL;
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

    private void CascadeSeriesMovies(int userId, int seriesId, bool completed, bool dated, int? year)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = completed
                ? """
                    INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
                    SELECT @userId, 'movie', id, CASE WHEN @dated THEN COALESCE(@completedAt, NOW()) ELSE NULL END
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
            AddCompletedAt(command, dated, year);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void SyncSeriesForMovie(int userId, int movieId, bool dated, int? year)
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
                    VALUES (@userId, 'series', @seriesId, CASE WHEN @dated THEN COALESCE(@completedAt, NOW()) ELSE NULL END)
                    ON CONFLICT (user_id, media_kind, media_id)
                    DO UPDATE SET completed_at = EXCLUDED.completed_at
                    """
                : """
                    DELETE FROM user_media_progress
                    WHERE user_id = @userId AND media_kind = 'series' AND media_id = @seriesId
                    """;
            progress.Parameters.AddWithValue("userId", userId);
            progress.Parameters.AddWithValue("seriesId", resolved);
            AddCompletedAt(progress, dated, year);
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

    private static (string Kind, int MediaId) ParseCatalogId(string? id) =>
        CatalogDb.ParseCatalogId(id, MediaKinds, "That title was not found.");

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
