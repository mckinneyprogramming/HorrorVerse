using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed partial class IgdbCatalogService(IConfiguration configuration)
{
    private static readonly object TokenLock = new();
    private static string? CachedToken;
    private static DateTimeOffset CachedTokenExpires;

    public async Task<object> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        var text = (query ?? string.Empty).Trim();
        if (text.Length < 2)
        {
            throw new InvalidOperationException("Enter at least two characters to search IGDB.");
        }

        var payload = await PostAsync(
            "games",
            $"search \"{Escape(text)}\"; fields name,summary,first_release_date,cover.image_id,genres.name,themes.name,platforms.name; limit 20;",
            cancellationToken);
        if (payload.ValueKind != JsonValueKind.Array)
        {
            return new { results = Array.Empty<object>() };
        }

        var hits = new List<(int Rank, int Index, object Hit)>();
        var index = 0;
        foreach (var doc in payload.EnumerateArray())
        {
            var sourceId = Id(doc);
            var title = Clean(doc, "name", 200);
            if (sourceId is null || title is null)
            {
                index += 1;
                continue;
            }

            var genres = Names(doc, "genres").ToList();
            var themes = Names(doc, "themes").ToList();
            var platforms = Names(doc, "platforms").Take(3);
            var overview = string.Join(" · ", new[] { string.Join(", ", genres.Take(2)), string.Join(", ", platforms) }.Where(part => !string.IsNullOrWhiteSpace(part)));
            hits.Add((
                genres.Concat(themes).Any(name => HorrorNamePattern().IsMatch(name)) ? 0 : 1,
                index,
                new
                {
                    sourceId,
                    title,
                    year = Year(doc),
                    overview = string.IsNullOrWhiteSpace(overview) ? null : overview,
                    coverUrl = CoverUrl(doc)
                }));
            index += 1;
        }

        return new { results = hits.OrderBy(hit => hit.Rank).ThenBy(hit => hit.Index).Take(8).Select(hit => hit.Hit) };
    }

    public async Task<object> ImportAsync(string? sourceId, CancellationToken cancellationToken)
    {
        if (!IdPattern().IsMatch(sourceId ?? string.Empty))
        {
            throw new InvalidOperationException("Choose an IGDB game to add.");
        }

        var id = sourceId!.Trim();
        EnsureGameColumns();
        var payload = await PostAsync(
            "games",
            $"where id = {id}; fields name,summary,first_release_date,cover.image_id,genres.name,themes.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;",
            cancellationToken);
        var doc = First(payload);
        var title = doc is { } game ? Clean(game, "name", 200) : null;
        if (doc is null || title is null)
        {
            throw new InvalidOperationException("IGDB did not return that game.");
        }

        var year = Year(doc.Value) ?? 0;
        var description = Clean(doc.Value, "summary", 4000);
        var cover = CoverUrl(doc.Value);
        var (developer, publisher) = Companies(doc.Value);
        var platforms = string.Join(", ", Names(doc.Value, "platforms").Take(8));
        var genres = Names(doc.Value, "genres").Concat(Names(doc.Value, "themes")).Distinct(StringComparer.OrdinalIgnoreCase).Take(12).ToList();
        var existing = FindGameId(id);
        var gameId = existing ?? InsertGame(title, year, id);
        UpdateGame(gameId, title, year, id, description, cover, developer, publisher, platforms);
        SaveGenres(gameId, genres);
        return new { added = existing is null ? 1 : 0, id = $"game:{gameId}" };
    }

    public void EnsureGameColumns()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS Game (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                ReleaseYear INTEGER NOT NULL,
                Played BOOLEAN NOT NULL);
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS IgdbId INTEGER;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Description TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS CoverUrl TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Developer TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Publisher TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Platforms TEXT;
            """;
        command.ExecuteNonQuery();
    }

    private async Task<JsonElement> PostAsync(string endpoint, string body, CancellationToken cancellationToken)
    {
        var token = await TokenAsync(cancellationToken);
        using var client = new HttpClient(OutboundHttp.CreateHandler()) { BaseAddress = new Uri("https://api.igdb.com/v4/") };
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(body, Encoding.UTF8, "text/plain")
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("Client-ID", ClientId());
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Could not reach IGDB.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return document.RootElement.Clone();
    }

    private async Task<string> TokenAsync(CancellationToken cancellationToken)
    {
        lock (TokenLock)
        {
            if (!string.IsNullOrWhiteSpace(CachedToken) && CachedTokenExpires > DateTimeOffset.UtcNow.AddMinutes(1))
            {
                return CachedToken;
            }
        }

        var secret = configuration["IGDB_CLIENT_SECRET"] ?? Environment.GetEnvironmentVariable("IGDB_CLIENT_SECRET");
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("IGDB_CLIENT_SECRET is not configured.");
        }

        using var client = new HttpClient(OutboundHttp.CreateHandler());
        using var response = await client.PostAsync(
            $"https://id.twitch.tv/oauth2/token?client_id={Uri.EscapeDataString(ClientId())}&client_secret={Uri.EscapeDataString(secret)}&grant_type=client_credentials",
            null,
            cancellationToken);
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        if (!response.IsSuccessStatusCode || !document.RootElement.TryGetProperty("access_token", out var token))
        {
            throw new InvalidOperationException("Could not authenticate with IGDB.");
        }

        var access = token.GetString() ?? string.Empty;
        var expires = document.RootElement.TryGetProperty("expires_in", out var seconds) && seconds.TryGetInt32(out var value)
            ? value
            : 3600;
        lock (TokenLock)
        {
            CachedToken = access;
            CachedTokenExpires = DateTimeOffset.UtcNow.AddSeconds(expires);
        }

        return access;
    }

    private string ClientId()
    {
        var clientId = configuration["IGDB_CLIENT_ID"] ?? Environment.GetEnvironmentVariable("IGDB_CLIENT_ID");
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new InvalidOperationException("IGDB_CLIENT_ID is not configured.");
        }

        return clientId;
    }

    private int? FindGameId(string sourceId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM Game WHERE IgdbId = @id LIMIT 1";
        command.Parameters.AddWithValue("id", int.Parse(sourceId));
        var value = command.ExecuteScalar();
        return value is null ? null : Convert.ToInt32(value);
    }

    private int InsertGame(string title, int year, string sourceId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Game (Title, ReleaseYear, Played, IgdbId)
            VALUES (@title, @year, FALSE, @sourceId)
            RETURNING Id
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("year", year);
        command.Parameters.AddWithValue("sourceId", int.Parse(sourceId));
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private void UpdateGame(
        int gameId,
        string title,
        int year,
        string sourceId,
        string? description,
        string? cover,
        string? developer,
        string? publisher,
        string platforms)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE Game
            SET Title = @title,
                ReleaseYear = CASE WHEN @year > 0 THEN @year ELSE ReleaseYear END,
                IgdbId = @sourceId,
                Description = @description,
                CoverUrl = @cover,
                Developer = @developer,
                Publisher = @publisher,
                Platforms = @platforms
            WHERE Id = @id
            """;
        command.Parameters.AddWithValue("id", gameId);
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("year", year);
        command.Parameters.AddWithValue("sourceId", int.Parse(sourceId));
        command.Parameters.AddWithValue("description", (object?)description ?? DBNull.Value);
        command.Parameters.AddWithValue("cover", (object?)cover ?? DBNull.Value);
        command.Parameters.AddWithValue("developer", (object?)developer ?? DBNull.Value);
        command.Parameters.AddWithValue("publisher", (object?)publisher ?? DBNull.Value);
        command.Parameters.AddWithValue("platforms", string.IsNullOrWhiteSpace(platforms) ? DBNull.Value : platforms);
        command.ExecuteNonQuery();
    }

    private void SaveGenres(int gameId, IReadOnlyList<string> genres)
    {
        using var connection = OpenConnection();
        using (var schema = connection.CreateCommand())
        {
            schema.CommandText = """
                CREATE TABLE IF NOT EXISTS media_keyword (
                    media_kind TEXT NOT NULL,
                    media_id INTEGER NOT NULL,
                    tmdb_keyword_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    PRIMARY KEY (media_kind, media_id, tmdb_keyword_id))
                """;
            schema.ExecuteNonQuery();
        }

        using (var clear = connection.CreateCommand())
        {
            clear.CommandText = "DELETE FROM media_keyword WHERE media_kind = 'game' AND media_id = @id";
            clear.Parameters.AddWithValue("id", gameId);
            clear.ExecuteNonQuery();
        }

        foreach (var genre in genres)
        {
            using var insert = connection.CreateCommand();
            insert.CommandText = """
                INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
                VALUES ('game', @id, @key, @name)
                ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name
                """;
            insert.Parameters.AddWithValue("id", gameId);
            insert.Parameters.AddWithValue("key", SubjectKey(genre));
            insert.Parameters.AddWithValue("name", genre);
            insert.ExecuteNonQuery();
        }
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

    private static JsonElement? First(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var item in payload.EnumerateArray())
        {
            return item;
        }

        return null;
    }

    private static string? Id(JsonElement element)
    {
        if (!element.TryGetProperty("id", out var value) || !value.TryGetInt32(out var id) || id < 1)
        {
            return null;
        }

        return id.ToString();
    }

    private static (string? Developer, string? Publisher) Companies(JsonElement element)
    {
        if (!element.TryGetProperty("involved_companies", out var companies) || companies.ValueKind != JsonValueKind.Array)
        {
            return (null, null);
        }

        var developers = new List<string>();
        var publishers = new List<string>();
        foreach (var company in companies.EnumerateArray())
        {
            var name = company.TryGetProperty("company", out var nested) ? Clean(nested, "name", 120) : null;
            if (name is null)
            {
                continue;
            }

            if (company.TryGetProperty("developer", out var developer) && developer.ValueKind == JsonValueKind.True)
            {
                developers.Add(name);
            }

            if (company.TryGetProperty("publisher", out var publisher) && publisher.ValueKind == JsonValueKind.True)
            {
                publishers.Add(name);
            }
        }

        return (
            developers.Count > 0 ? string.Join(", ", developers.Take(3)) : null,
            publishers.Count > 0 ? string.Join(", ", publishers.Take(3)) : null);
    }

    private static IEnumerable<string> Names(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }

        foreach (var item in value.EnumerateArray())
        {
            var text = Clean(item, "name", 80);
            if (text is not null)
            {
                yield return text;
            }
        }
    }

    private static string? CoverUrl(JsonElement element)
    {
        if (!element.TryGetProperty("cover", out var cover) || !cover.TryGetProperty("image_id", out var image))
        {
            return null;
        }

        var id = image.GetString() ?? string.Empty;
        return CoverIdPattern().IsMatch(id) ? $"https://images.igdb.com/igdb/image/upload/t_cover_big/{id}.jpg" : null;
    }

    private static int? Year(JsonElement element)
    {
        if (!element.TryGetProperty("first_release_date", out var value) || !value.TryGetInt64(out var seconds) || seconds < 1)
        {
            return null;
        }

        var year = DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime.Year;
        return year is >= 1 and <= 3000 ? year : null;
    }

    private static string? Clean(JsonElement element, string name, int max)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var text = string.Join(' ', value.GetString()!.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (text.Length < 1)
        {
            return null;
        }

        return text.Length > max ? text[..max].Trim() : text;
    }

    private static string Escape(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);

    private static int SubjectKey(string name)
    {
        var hash = 0u;
        foreach (var character in name.ToLowerInvariant())
        {
            hash = (hash * 33) + character;
        }

        var key = (int)(hash % 2_000_000_000);
        return key == 0 ? 1 : key;
    }

    [GeneratedRegex(@"^\d+$")]
    private static partial Regex IdPattern();

    [GeneratedRegex(@"^[A-Za-z0-9_-]+$")]
    private static partial Regex CoverIdPattern();

    [GeneratedRegex(@"horror|survival horror", RegexOptions.IgnoreCase)]
    private static partial Regex HorrorNamePattern();
}
