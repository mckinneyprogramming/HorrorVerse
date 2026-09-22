using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Library;
using Npgsql;

namespace HorrorTracker.Api.Social;

public sealed class SocialService(IConfiguration configuration, UserLibraryService library)
{
    public IReadOnlyList<PersonCardDto> Search(AuthUserDto viewer, string? query)
    {
        EnsureSchema();
        var q = (query ?? string.Empty).Trim();
        if (q.Length < 2)
        {
            throw new InvalidOperationException("Enter at least two letters to find someone.");
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, display_name, about_me, avatar
            FROM app_user
            WHERE id <> @me AND display_name ILIKE @query
            ORDER BY lower(display_name), id
            LIMIT 20
            """;
        command.Parameters.AddWithValue("me", viewer.Id);
        command.Parameters.AddWithValue("query", $"%{EscapeLike(q)}%");
        return ReadPeople(command, viewer.Id, includeActivity: false);
    }

    public PersonCardDto GetProfile(AuthUserDto viewer, int? userId)
    {
        EnsureSchema();
        var id = RequireUserId(userId);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, display_name, about_me, avatar
            FROM app_user
            WHERE id = @id
            """;
        command.Parameters.AddWithValue("id", id);
        var people = ReadPeople(command, viewer.Id, includeActivity: true);
        if (people.Count < 1)
        {
            throw new InvalidOperationException("That member was not found.");
        }

        return people[0];
    }

    public FriendInboxDto GetInbox(AuthUserDto viewer)
    {
        EnsureSchema();
        return new FriendInboxDto(
            LoadRelated(viewer.Id, """
                SELECT u.id, u.display_name, u.about_me, u.avatar
                FROM user_friendship f
                JOIN app_user u ON u.id = f.friend_id
                WHERE f.user_id = @me
                ORDER BY lower(u.display_name), u.id
                """),
            LoadRelated(viewer.Id, """
                SELECT u.id, u.display_name, u.about_me, u.avatar
                FROM user_friend_request r
                JOIN app_user u ON u.id = r.requester_id
                WHERE r.addressee_id = @me
                ORDER BY r.created_at DESC, u.id
                """),
            LoadRelated(viewer.Id, """
                SELECT u.id, u.display_name, u.about_me, u.avatar
                FROM user_friend_request r
                JOIN app_user u ON u.id = r.addressee_id
                WHERE r.requester_id = @me
                ORDER BY r.created_at DESC, u.id
                """),
            LoadRelated(viewer.Id, """
                SELECT u.id, u.display_name, u.about_me, u.avatar
                FROM user_follow f
                JOIN app_user u ON u.id = f.following_id
                WHERE f.follower_id = @me
                ORDER BY lower(u.display_name), u.id
                """));
    }

    public FriendInboxDto SendRequest(AuthUserDto viewer, int? userId)
    {
        EnsureSchema();
        var otherId = RequireOtherUser(viewer.Id, userId);
        if (AreFriends(viewer.Id, otherId))
        {
            throw new InvalidOperationException("You are already friends.");
        }

        if (HasRequest(otherId, viewer.Id))
        {
            AcceptRequest(viewer.Id, otherId);
            return GetInbox(viewer);
        }

        if (HasRequest(viewer.Id, otherId))
        {
            throw new InvalidOperationException("You already sent a friend request.");
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO user_friend_request (requester_id, addressee_id)
            VALUES (@me, @other)
            ON CONFLICT DO NOTHING
            """;
        command.Parameters.AddWithValue("me", viewer.Id);
        command.Parameters.AddWithValue("other", otherId);
        command.ExecuteNonQuery();
        return GetInbox(viewer);
    }

    public FriendInboxDto Respond(AuthUserDto viewer, SocialWriteRequest request)
    {
        EnsureSchema();
        var otherId = RequireOtherUser(viewer.Id, request.UserId);
        var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        if (action == "accept")
        {
            if (!HasRequest(otherId, viewer.Id))
            {
                throw new InvalidOperationException("That friend request is no longer waiting.");
            }

            AcceptRequest(viewer.Id, otherId);
            return GetInbox(viewer);
        }

        if (action is "decline" or "cancel")
        {
            DeleteRequest(viewer.Id, otherId);
            return GetInbox(viewer);
        }

        throw new InvalidOperationException("Choose accept, decline, or cancel.");
    }

    public FriendInboxDto Unfriend(AuthUserDto viewer, int? userId)
    {
        EnsureSchema();
        var otherId = RequireOtherUser(viewer.Id, userId);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM user_friendship
            WHERE (user_id = @me AND friend_id = @other) OR (user_id = @other AND friend_id = @me);
            DELETE FROM user_friend_request
            WHERE (requester_id = @me AND addressee_id = @other) OR (requester_id = @other AND addressee_id = @me);
            """;
        command.Parameters.AddWithValue("me", viewer.Id);
        command.Parameters.AddWithValue("other", otherId);
        command.ExecuteNonQuery();
        return GetInbox(viewer);
    }

    public PersonCardDto Follow(AuthUserDto viewer, int? userId)
    {
        EnsureSchema();
        var otherId = RequireOtherUser(viewer.Id, userId);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO user_follow (follower_id, following_id)
            VALUES (@me, @other)
            ON CONFLICT DO NOTHING
            """;
        command.Parameters.AddWithValue("me", viewer.Id);
        command.Parameters.AddWithValue("other", otherId);
        command.ExecuteNonQuery();
        return GetProfile(viewer, otherId);
    }

    public PersonCardDto Unfollow(AuthUserDto viewer, int? userId)
    {
        EnsureSchema();
        var otherId = RequireOtherUser(viewer.Id, userId);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM user_follow WHERE follower_id = @me AND following_id = @other";
        command.Parameters.AddWithValue("me", viewer.Id);
        command.Parameters.AddWithValue("other", otherId);
        command.ExecuteNonQuery();
        return GetProfile(viewer, otherId);
    }

    private IReadOnlyList<PersonCardDto> LoadRelated(int viewerId, string sql)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("me", viewerId);
        return ReadPeople(command, viewerId, includeActivity: false);
    }

    private List<PersonCardDto> ReadPeople(NpgsqlCommand command, int viewerId, bool includeActivity)
    {
        var rows = new List<(int Id, string Name, string? About, string? Avatar)>();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                rows.Add((
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3)));
            }
        }

        return rows.Select(row => ToCard(viewerId, row.Id, row.Name, row.About, row.Avatar, includeActivity)).ToList();
    }

    private PersonCardDto ToCard(int viewerId, int id, string name, string? about, string? avatar, bool includeActivity)
    {
        var relation = RelationOf(viewerId, id);
        var following = IsFollowing(viewerId, id);
        var canSee = viewerId == id || relation == "friends" || following;
        return new PersonCardDto(
            id,
            name,
            about,
            avatar,
            CountFriends(id),
            CountFollowers(id),
            CountFollowing(id),
            relation,
            following,
            IsFollowing(id, viewerId),
            includeActivity && canSee ? library.GetPublicLists(id, viewerId == id) : null,
            includeActivity && canSee ? library.GetCompletedIds(id) : null);
    }

    private string RelationOf(int viewerId, int otherId)
    {
        if (viewerId == otherId)
        {
            return "self";
        }

        if (AreFriends(viewerId, otherId))
        {
            return "friends";
        }

        if (HasRequest(viewerId, otherId))
        {
            return "outgoing";
        }

        if (HasRequest(otherId, viewerId))
        {
            return "incoming";
        }

        return "none";
    }

    private bool AreFriends(int left, int right)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM user_friendship WHERE user_id = @left AND friend_id = @right";
        command.Parameters.AddWithValue("left", left);
        command.Parameters.AddWithValue("right", right);
        return command.ExecuteScalar() is not null;
    }

    private bool HasRequest(int requesterId, int addresseeId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM user_friend_request WHERE requester_id = @from AND addressee_id = @to";
        command.Parameters.AddWithValue("from", requesterId);
        command.Parameters.AddWithValue("to", addresseeId);
        return command.ExecuteScalar() is not null;
    }

    private bool IsFollowing(int followerId, int followingId)
    {
        if (followerId == followingId)
        {
            return false;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM user_follow WHERE follower_id = @from AND following_id = @to";
        command.Parameters.AddWithValue("from", followerId);
        command.Parameters.AddWithValue("to", followingId);
        return command.ExecuteScalar() is not null;
    }

    private int CountFriends(int userId) => Count("SELECT COUNT(*) FROM user_friendship WHERE user_id = @id", userId);

    private int CountFollowers(int userId) => Count("SELECT COUNT(*) FROM user_follow WHERE following_id = @id", userId);

    private int CountFollowing(int userId) => Count("SELECT COUNT(*) FROM user_follow WHERE follower_id = @id", userId);

    private int Count(string sql, int userId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("id", userId);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private void AcceptRequest(int viewerId, int requesterId)
    {
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();
        using var insert = connection.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
            INSERT INTO user_friendship (user_id, friend_id)
            VALUES (@me, @other)
            ON CONFLICT DO NOTHING;
            INSERT INTO user_friendship (user_id, friend_id)
            VALUES (@other, @me)
            ON CONFLICT DO NOTHING;
            """;
        insert.Parameters.AddWithValue("me", viewerId);
        insert.Parameters.AddWithValue("other", requesterId);
        insert.ExecuteNonQuery();
        using var delete = connection.CreateCommand();
        delete.Transaction = transaction;
        delete.CommandText = """
            DELETE FROM user_friend_request
            WHERE (requester_id = @me AND addressee_id = @other)
               OR (requester_id = @other AND addressee_id = @me)
            """;
        delete.Parameters.AddWithValue("me", viewerId);
        delete.Parameters.AddWithValue("other", requesterId);
        delete.ExecuteNonQuery();
        transaction.Commit();
    }

    private void DeleteRequest(int viewerId, int otherId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM user_friend_request
            WHERE (requester_id = @me AND addressee_id = @other)
               OR (requester_id = @other AND addressee_id = @me)
            """;
        command.Parameters.AddWithValue("me", viewerId);
        command.Parameters.AddWithValue("other", otherId);
        command.ExecuteNonQuery();
    }

    private int RequireOtherUser(int viewerId, int? userId)
    {
        var id = RequireUserId(userId);
        if (id == viewerId)
        {
            throw new InvalidOperationException("That has to be someone else.");
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM app_user WHERE id = @id";
        command.Parameters.AddWithValue("id", id);
        if (command.ExecuteScalar() is null)
        {
            throw new InvalidOperationException("That member was not found.");
        }

        return id;
    }

    private static int RequireUserId(int? userId)
    {
        if (userId is null or < 1)
        {
            throw new InvalidOperationException("That member was not found.");
        }

        return userId.Value;
    }

    private static string EscapeLike(string value) => value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    public void EnsureSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            ALTER TABLE app_user ADD COLUMN IF NOT EXISTS about_me TEXT;
            ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar TEXT;
            CREATE TABLE IF NOT EXISTS user_friend_request (
                requester_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                addressee_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (requester_id, addressee_id),
                CHECK (requester_id <> addressee_id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS user_friend_request_pair_idx
                ON user_friend_request (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
            CREATE TABLE IF NOT EXISTS user_friendship (
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                friend_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, friend_id),
                CHECK (user_id <> friend_id)
            );
            CREATE TABLE IF NOT EXISTS user_follow (
                follower_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                following_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (follower_id, following_id),
                CHECK (follower_id <> following_id)
            );
            ALTER TABLE user_list ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
            """;
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection OpenConnection()
    {
        var connectionString = CatalogService.ResolveConnectionString(configuration);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("DATABASE_URL is not configured.");
        }

        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }
}
