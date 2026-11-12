using System.Text.Json;
using HorrorTracker.Api.Auth;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed record TalentFollowRequest(int PersonId);

public sealed class TalentCatalogService(IConfiguration configuration)
{
    private static readonly HttpClient Http = new(OutboundHttp.CreateHandler()) { Timeout = TimeSpan.FromSeconds(20) };

    public async Task<object> GetAsync(AuthUserDto user, string? title, string? person, CancellationToken cancellationToken)
    {
        EnsureSchema();
        if (!string.IsNullOrWhiteSpace(title))
        {
            return await TitleCreditsAsync(title, cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(person))
        {
            if (!int.TryParse(person, out var personId))
            {
                throw new InvalidOperationException("Choose a person to open.");
            }

            return new { person = await OpenPersonAsync(user.Id, personId, cancellationToken) };
        }

        return new { people = await ListFollowedAsync(user.Id, cancellationToken) };
    }

    public async Task<object> FollowAsync(AuthUserDto user, int personId, CancellationToken cancellationToken)
    {
        var person = await OpenPersonAsync(user.Id, personId, cancellationToken);
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO user_talent_follow (user_id, person_id, name, profile_path, known_for)
            VALUES (@userId, @personId, @name, @profilePath, @knownFor)
            ON CONFLICT (user_id, person_id) DO UPDATE
            SET name = EXCLUDED.name, profile_path = EXCLUDED.profile_path, known_for = EXCLUDED.known_for
            """;
        command.Parameters.AddWithValue("userId", user.Id);
        command.Parameters.AddWithValue("personId", person.Id);
        command.Parameters.AddWithValue("name", person.Name);
        command.Parameters.AddWithValue("profilePath", (object?)person.ProfilePath ?? DBNull.Value);
        command.Parameters.AddWithValue("knownFor", (object?)person.KnownFor ?? DBNull.Value);
        command.ExecuteNonQuery();
        return new { person = person with { Following = true } };
    }

    public async Task<object> UnfollowAsync(AuthUserDto user, int? personId, CancellationToken cancellationToken)
    {
        if (personId is not int id)
        {
            throw new InvalidOperationException("Choose a person to open.");
        }

        RequirePersonId(id);
        EnsureSchema();
        using (var connection = Open())
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "DELETE FROM user_talent_follow WHERE user_id = @userId AND person_id = @personId";
            command.Parameters.AddWithValue("userId", user.Id);
            command.Parameters.AddWithValue("personId", id);
            command.ExecuteNonQuery();
        }

        try
        {
            var person = await OpenPersonAsync(user.Id, id, cancellationToken);
            return new { person = person with { Following = false } };
        }
        catch (InvalidOperationException exception) when (exception.Message == "That person was not found.")
        {
            return new
            {
                person = new TalentPersonDto(id, "Unknown", null, null, false, 0, 0, []),
            };
        }
    }

    private async Task<object> TitleCreditsAsync(string titleId, CancellationToken cancellationToken)
    {
        if (!TryParseTitle(titleId, out var kind, out var mediaId))
        {
            return new { directors = Array.Empty<TalentNameDto>(), cast = Array.Empty<TalentNameDto>() };
        }

        var tmdbId = LookupTmdbId(kind, mediaId);
        if (tmdbId is not int id)
        {
            return new { directors = Array.Empty<TalentNameDto>(), cast = Array.Empty<TalentNameDto>() };
        }

        var path = kind == "show" ? $"/tv/{id}/credits" : $"/movie/{id}/credits";
        using var document = await GetTmdbAsync(path, cancellationToken);
        var credits = document is null
            ? ([], [])
            : TalentFilmography.ReadTitle(document.RootElement);
        return new
        {
            directors = credits.Item1.Select(ToName).ToList(),
            cast = credits.Item2.Select(ToName).ToList(),
        };
    }

    private async Task<TalentPersonDto> OpenPersonAsync(int userId, int personId, CancellationToken cancellationToken)
    {
        RequirePersonId(personId);
        EnsureSchema();
        using var document = await GetTmdbAsync($"/person/{personId}?append_to_response=combined_credits", cancellationToken);
        var selected = document is null ? null : TalentFilmography.ReadPerson(document.RootElement);
        if (selected is null)
        {
            throw new InvalidOperationException("That person was not found.");
        }

        ReplaceCredits(personId, selected.Credits);
        var credits = Annotate(userId, selected.Credits);
        return new TalentPersonDto(
            personId,
            selected.Name,
            selected.ProfilePath,
            selected.KnownFor,
            IsFollowing(userId, personId),
            credits.Count(credit => credit.Finished),
            credits.Count,
            credits);
    }

    private async Task<List<TalentFollowDto>> ListFollowedAsync(int userId, CancellationToken cancellationToken)
    {
        var follows = new List<(int Id, string Name, string? ProfilePath, string? KnownFor)>();
        using (var connection = Open())
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT person_id, name, profile_path, known_for
                FROM user_talent_follow
                WHERE user_id = @userId
                ORDER BY created_at DESC, person_id
                """;
            command.Parameters.AddWithValue("userId", userId);
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var name = reader.GetString(1).Trim();
                if (name.Length is < 1 or > 200)
                {
                    continue;
                }

                follows.Add((
                    reader.GetInt32(0),
                    name,
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3)));
            }
        }

        var people = new List<TalentFollowDto>();
        foreach (var follow in follows)
        {
            var stored = ReadCached(follow.Id);
            var credits = stored.Count > 0
                ? Annotate(userId, stored)
                : (await LoadCachedPersonAsync(userId, follow.Id, cancellationToken))?.Credits ?? [];
            people.Add(new TalentFollowDto(
                follow.Id,
                follow.Name,
                PosterOrNull(follow.ProfilePath),
                ClipOrNull(follow.KnownFor, 40),
                credits.Count(credit => credit.Finished),
                credits.Count));
        }

        return people;
    }

    private async Task<TalentPersonDto?> LoadCachedPersonAsync(int userId, int personId, CancellationToken cancellationToken)
    {
        try
        {
            return await OpenPersonAsync(userId, personId, cancellationToken);
        }
        catch (InvalidOperationException exception) when (exception.Message == "That person was not found.")
        {
            return null;
        }
    }

    private List<TalentCreditDto> Annotate(int userId, IReadOnlyList<StoredCredit> credits)
    {
        var vault = VaultByTmdb();
        var finished = FinishedIds(userId);
        return credits.Select(credit =>
        {
            vault.TryGetValue($"{credit.Kind}:{credit.TmdbId}", out var vaultId);
            return new TalentCreditDto(
                credit.TmdbId,
                credit.MediaType,
                credit.Kind,
                credit.Title,
                credit.Year,
                credit.PosterPath,
                credit.Role,
                vaultId,
                vaultId is not null && finished.Contains(vaultId));
        }).ToList();
    }

    private Dictionary<string, string> VaultByTmdb()
    {
        var vault = new Dictionary<string, string>();
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT 'movie' AS kind, id, tmdbid FROM movie WHERE tmdbid IS NOT NULL
            UNION ALL
            SELECT 'documentary', id, tmdbid FROM documentary WHERE tmdbid IS NOT NULL
            UNION ALL
            SELECT 'show', id, tmdbid FROM show WHERE tmdbid IS NOT NULL
            """;
        using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var kind = reader.GetString(0);
                vault[$"{kind}:{reader.GetInt32(2)}"] = $"{kind}:{reader.GetInt32(1)}";
            }

        return vault;
    }

    private HashSet<string> FinishedIds(int userId)
    {
        var ids = new HashSet<string>();
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT media_kind, media_id
            FROM user_media_progress
            WHERE user_id = @userId AND completed_at IS NOT NULL
            """;
        command.Parameters.AddWithValue("userId", userId);
        using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                ids.Add($"{reader.GetString(0)}:{reader.GetInt32(1)}");
            }

        return ids;
    }

    private List<StoredCredit> ReadCached(int personId)
    {
        var credits = new List<StoredCredit>();
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT media_type, tmdb_id, title, release_year, poster_path, role, kind
            FROM talent_filmography
            WHERE person_id = @personId
            """;
        command.Parameters.AddWithValue("personId", personId);
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var mediaType = reader.GetString(0);
            var tmdbId = reader.GetInt32(1);
            var title = reader.GetString(2).Trim();
            var kind = reader.GetString(6);
            var role = reader.GetString(5).Trim();
            if (mediaType is not ("movie" or "tv") || tmdbId < 1 || title.Length is < 1 or > 200 || kind is not ("movie" or "documentary" or "show") || role.Length is < 1 or > 120)
            {
                continue;
            }

            var year = reader.IsDBNull(3) ? null : ReadId(reader.GetValue(3));
            var poster = reader.IsDBNull(4) ? null : PosterOrNull(reader.GetString(4));
            credits.Add(new StoredCredit(tmdbId, mediaType, kind, title, year, poster, role));
        }

        return credits;
    }

    private bool IsFollowing(int userId, int personId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM user_talent_follow WHERE user_id = @userId AND person_id = @personId";
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("personId", personId);
        return command.ExecuteScalar() is not null;
    }

    private int? LookupTmdbId(string kind, int mediaId)
    {
        var table = kind == "movie" ? "movie" : kind == "documentary" ? "documentary" : "show";
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT tmdbid FROM {table} WHERE id = @id";
        command.Parameters.AddWithValue("id", mediaId);
        return ReadId(command.ExecuteScalar());
    }

    private void ReplaceCredits(int personId, IReadOnlyList<StoredCredit> credits)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        using (var delete = connection.CreateCommand())
        {
            delete.Transaction = transaction;
            delete.CommandText = "DELETE FROM talent_filmography WHERE person_id = @personId";
            delete.Parameters.AddWithValue("personId", personId);
            delete.ExecuteNonQuery();
        }

        foreach (var credit in credits)
        {
            using var insert = connection.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = """
                INSERT INTO talent_filmography
                    (person_id, media_type, tmdb_id, title, release_year, poster_path, role, kind, refreshed_at)
                VALUES
                    (@personId, @mediaType, @tmdbId, @title, @year, @posterPath, @role, @kind, NOW())
                """;
            insert.Parameters.AddWithValue("personId", personId);
            insert.Parameters.AddWithValue("mediaType", credit.MediaType);
            insert.Parameters.AddWithValue("tmdbId", credit.TmdbId);
            insert.Parameters.AddWithValue("title", credit.Title);
            insert.Parameters.AddWithValue("year", (object?)credit.Year ?? DBNull.Value);
            insert.Parameters.AddWithValue("posterPath", (object?)credit.PosterPath ?? DBNull.Value);
            insert.Parameters.AddWithValue("role", credit.Role);
            insert.Parameters.AddWithValue("kind", credit.Kind);
            insert.ExecuteNonQuery();
        }

        transaction.Commit();
    }

    private void EnsureSchema()
    {
        using var connection = Open();
        Execute(connection, "ALTER TABLE movie ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
        Execute(connection, "ALTER TABLE documentary ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
        Execute(connection, "ALTER TABLE show ADD COLUMN IF NOT EXISTS tmdbid INTEGER");
        Execute(connection, """
            CREATE TABLE IF NOT EXISTS user_talent_follow (
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                person_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                profile_path TEXT,
                known_for TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, person_id)
            )
            """);
        Execute(connection, """
            CREATE TABLE IF NOT EXISTS talent_filmography (
                person_id INTEGER NOT NULL,
                media_type TEXT NOT NULL,
                tmdb_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                release_year INTEGER,
                poster_path TEXT,
                role TEXT NOT NULL,
                kind TEXT NOT NULL,
                refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (person_id, media_type, tmdb_id)
            )
            """);
    }

    private static void Execute(NpgsqlConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private async Task<JsonDocument?> GetTmdbAsync(string path, CancellationToken cancellationToken)
    {
        var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("TMDBKey is not configured.");
        }

        try
        {
            var separator = path.Contains('?') ? "&" : "?";
            using var response = await Http.GetAsync(
                $"https://api.themoviedb.org/3{path}{separator}api_key={Uri.EscapeDataString(apiKey)}",
                cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException)
        {
            return null;
        }
    }

    private NpgsqlConnection Open() => CatalogDb.Open(configuration);

    private static void RequirePersonId(int personId)
    {
        if (personId < 1)
        {
            throw new InvalidOperationException("Choose a person to open.");
        }
    }

    private static bool TryParseTitle(string titleId, out string kind, out int mediaId)
    {
        kind = "";
        mediaId = 0;
        var parts = titleId.Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || parts[0] is not ("movie" or "documentary" or "show") || !int.TryParse(parts[1], out mediaId) || mediaId < 1)
        {
            return false;
        }

        kind = parts[0];
        return true;
    }

    private static int? ReadId(object? value)
    {
        if (value is null or DBNull)
        {
            return null;
        }

        var id = Convert.ToInt64(value);
        return id > 0 ? (int)id : null;
    }

    private static string? PosterOrNull(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !path.StartsWith('/') || path.Length > 160 || path.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        return path;
    }

    private static string? ClipOrNull(string? value, int max)
    {
        var text = (value ?? "").Trim();
        if (text.Length == 0)
        {
            return null;
        }

        return text.Length <= max ? text : text[..max].TrimEnd();
    }

    private static TalentNameDto ToName(TalentName person) => new(person.Id, person.Name, person.Role, person.ProfilePath);
}

public sealed record TalentNameDto(int Id, string Name, string Role, string? ProfilePath);

public sealed record TalentCreditDto(
    int TmdbId,
    string MediaType,
    string Kind,
    string Title,
    int? Year,
    string? PosterPath,
    string Role,
    string? VaultId,
    bool Finished);

public sealed record TalentPersonDto(
    int Id,
    string Name,
    string? ProfilePath,
    string? KnownFor,
    bool Following,
    int Watched,
    int Total,
    IReadOnlyList<TalentCreditDto> Credits);

public sealed record TalentFollowDto(int Id, string Name, string? ProfilePath, string? KnownFor, int Watched, int Total);
