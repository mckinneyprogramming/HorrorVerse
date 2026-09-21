using System.Text.Json;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed class KeywordCatalogService(IConfiguration configuration)
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public void EnsureSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            ALTER TABLE Movie ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            ALTER TABLE Documentary ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            CREATE TABLE IF NOT EXISTS media_keyword (
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                tmdb_keyword_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                PRIMARY KEY (media_kind, media_id, tmdb_keyword_id));
            CREATE INDEX IF NOT EXISTS media_keyword_name_idx
                ON media_keyword (lower(name));
            """;
        command.ExecuteNonQuery();
    }

    public IReadOnlyDictionary<string, IReadOnlyList<string>> LoadAll()
    {
        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT media_kind, media_id, name
            FROM media_keyword
            ORDER BY lower(name)
            """;
        using var reader = command.ExecuteReader();
        var grouped = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
        {
            var key = $"{reader.GetString(0)}:{reader.GetInt32(1)}";
            if (!grouped.TryGetValue(key, out var names))
            {
                names = [];
                grouped[key] = names;
            }

            var name = reader.GetString(2).Trim();
            if (name.Length > 0 && !names.Contains(name, StringComparer.OrdinalIgnoreCase))
            {
                names.Add(name);
            }
        }

        return grouped.ToDictionary(pair => pair.Key, pair => (IReadOnlyList<string>)pair.Value, StringComparer.OrdinalIgnoreCase);
    }

    public void DeleteFor(string kind, int mediaId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM media_keyword WHERE media_kind = @kind AND media_id = @id";
            command.Parameters.AddWithValue("kind", kind);
            command.Parameters.AddWithValue("id", mediaId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Keyword table is created on first catalog read or TMDb import.
        }
    }

    public bool HasAny(string kind, int mediaId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT 1 FROM media_keyword
            WHERE media_kind = @kind AND media_id = @id
            LIMIT 1
            """;
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("id", mediaId);
        return command.ExecuteScalar() is not null;
    }

    public async Task SaveMovieAsync(int mediaId, int tmdbId, bool skipIfPresent = false, CancellationToken cancellationToken = default)
    {
        EnsureSchema();
        SaveTmdbId("movie", mediaId, tmdbId);
        if (skipIfPresent && HasAny("movie", mediaId))
        {
            return;
        }

        Replace("movie", mediaId, await FetchAsync("movie", tmdbId, cancellationToken));
    }

    public async Task SaveDocumentaryAsync(int mediaId, int tmdbId, bool skipIfPresent = false, CancellationToken cancellationToken = default)
    {
        EnsureSchema();
        SaveTmdbId("documentary", mediaId, tmdbId);
        if (skipIfPresent && HasAny("documentary", mediaId))
        {
            return;
        }

        Replace("documentary", mediaId, await FetchAsync("movie", tmdbId, cancellationToken));
    }

    public async Task SaveShowAsync(int mediaId, int tmdbId, bool skipIfPresent = false, CancellationToken cancellationToken = default)
    {
        EnsureSchema();
        if (skipIfPresent && HasAny("show", mediaId))
        {
            return;
        }

        Replace("show", mediaId, await FetchAsync("tv", tmdbId, cancellationToken));
    }

    public void ReplaceSeriesFromMovies(int seriesId)
    {
        try
        {
            ReplaceSeriesFromMoviesCore(seriesId);
        }
        catch (PostgresException)
        {
            // Series tags can be rebuilt on the next sync.
        }
    }

    private void ReplaceSeriesFromMoviesCore(int seriesId)
    {
        EnsureSchema();
        using var connection = OpenConnection();
        using var delete = connection.CreateCommand();
        delete.CommandText = "DELETE FROM media_keyword WHERE media_kind = 'series' AND media_id = @id";
        delete.Parameters.AddWithValue("id", seriesId);
        delete.ExecuteNonQuery();
        using var insert = connection.CreateCommand();
        insert.CommandText = """
            INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
            SELECT DISTINCT ON (k.tmdb_keyword_id) 'series', @id, k.tmdb_keyword_id, k.name
            FROM media_keyword k
            JOIN Movie m ON m.Id = k.media_id
            WHERE k.media_kind = 'movie' AND m.SeriesId = @id
            ORDER BY k.tmdb_keyword_id, k.name
            ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO NOTHING
            """;
        insert.Parameters.AddWithValue("id", seriesId);
        insert.ExecuteNonQuery();
    }

    public IReadOnlyList<KeywordTarget> ListMovies() => ListTargets(
        "SELECT Id, Title, ReleaseYear, TmdbId FROM Movie ORDER BY Id",
        "movie");

    public IReadOnlyList<KeywordTarget> ListDocumentaries() => ListTargets(
        "SELECT Id, Title, ReleaseYear, TmdbId FROM Documentary ORDER BY Id",
        "documentary");

    public IReadOnlyList<KeywordTarget> ListShows() => ListTargets(
        "SELECT Id, Title, NULL, TmdbId FROM Show ORDER BY Id",
        "show");

    public IReadOnlyList<int> ListSeriesIds()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM MovieSeries ORDER BY Id";
        using var reader = command.ExecuteReader();
        var ids = new List<int>();
        while (reader.Read())
        {
            ids.Add(reader.GetInt32(0));
        }

        return ids;
    }

    public void SaveTmdbId(string kind, int mediaId, int tmdbId)
    {
        var sql = kind switch
        {
            "movie" => "UPDATE Movie SET TmdbId = @tmdbId WHERE Id = @id",
            "documentary" => "UPDATE Documentary SET TmdbId = @tmdbId WHERE Id = @id",
            "show" => "UPDATE Show SET TmdbId = @tmdbId WHERE Id = @id",
            "series" => "UPDATE MovieSeries SET TmdbId = @tmdbId WHERE Id = @id",
            _ => null,
        };
        if (sql is null)
        {
            return;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("tmdbId", tmdbId);
        command.Parameters.AddWithValue("id", mediaId);
        command.ExecuteNonQuery();
    }

    private void Replace(string kind, int mediaId, IReadOnlyList<KeywordHit> keywords)
    {
        using var connection = OpenConnection();
        using var delete = connection.CreateCommand();
        delete.CommandText = "DELETE FROM media_keyword WHERE media_kind = @kind AND media_id = @id";
        delete.Parameters.AddWithValue("kind", kind);
        delete.Parameters.AddWithValue("id", mediaId);
        delete.ExecuteNonQuery();
        foreach (var keyword in keywords)
        {
            using var insert = connection.CreateCommand();
            insert.CommandText = """
                INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
                VALUES (@kind, @id, @keywordId, @name)
                ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name
                """;
            insert.Parameters.AddWithValue("kind", kind);
            insert.Parameters.AddWithValue("id", mediaId);
            insert.Parameters.AddWithValue("keywordId", keyword.Id);
            insert.Parameters.AddWithValue("name", keyword.Name);
            insert.ExecuteNonQuery();
        }
    }

    private IReadOnlyList<KeywordTarget> ListTargets(string sql, string kind)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            using var reader = command.ExecuteReader();
            var items = new List<KeywordTarget>();
            while (reader.Read())
            {
                items.Add(new KeywordTarget(
                    kind,
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetInt32(2),
                    reader.IsDBNull(3) ? null : reader.GetInt32(3)));
            }

            return items;
        }
        catch (PostgresException)
        {
            return [];
        }
    }

    private async Task<IReadOnlyList<KeywordHit>> FetchAsync(string tmdbKind, int tmdbId, CancellationToken cancellationToken)
    {
        var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
        if (string.IsNullOrWhiteSpace(apiKey) || tmdbId < 1)
        {
            return [];
        }

        var url = $"https://api.themoviedb.org/3/{tmdbKind}/{tmdbId}/keywords?api_key={Uri.EscapeDataString(apiKey)}";
        using var response = await Http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return [];
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var root = document.RootElement;
        var array = root.TryGetProperty("keywords", out var movieKeywords)
            ? movieKeywords
            : root.TryGetProperty("results", out var tvKeywords) ? tvKeywords : default;
        if (array.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var hits = new List<KeywordHit>();
        foreach (var item in array.EnumerateArray())
        {
            var id = item.TryGetProperty("id", out var idValue) ? idValue.GetInt32() : 0;
            var name = item.TryGetProperty("name", out var nameValue) ? nameValue.GetString()?.Trim() ?? "" : "";
            if (id > 0 && name.Length is > 0 and <= 80)
            {
                hits.Add(new KeywordHit(id, name));
            }
        }

        return hits;
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

    public sealed record KeywordTarget(string Kind, int Id, string Title, int? Year, int? TmdbId);

    private sealed record KeywordHit(int Id, string Name);
}
