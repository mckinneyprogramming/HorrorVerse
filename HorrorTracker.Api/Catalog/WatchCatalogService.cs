using System.Collections.Concurrent;
using System.Text.Json;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed class WatchCatalogService(IConfiguration configuration, KeywordCatalogService keywords)
{
    private const string Region = "US";
    private const string Attribution = "JustWatch";
    private static readonly TimeSpan CacheFor = TimeSpan.FromHours(6);
    private static readonly ConcurrentDictionary<string, CacheEntry> Cache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public async Task<WatchOfferDto> GetAsync(string? id, CancellationToken cancellationToken)
    {
        var (kind, mediaId) = ParseId(id);
        if (kind is not ("movie" or "documentary" or "show"))
        {
            throw new InvalidOperationException(kind == "series"
                ? "Open a movie in the series to see where it is streaming."
                : "Streaming is only available for movies, documentaries, and TV shows.");
        }

        var cacheKey = $"{kind}:{mediaId}:{Region}";
        if (Cache.TryGetValue(cacheKey, out var cached) && cached.Expires > DateTimeOffset.UtcNow)
        {
            return cached.Offer;
        }

        var target = ReadTarget(kind, mediaId) ?? throw new InvalidOperationException("That title was not found.");
        var tmdbKind = kind == "show" ? "tv" : "movie";
        var tmdbId = target.TmdbId ?? await ResolveTmdbIdAsync(tmdbKind, target.Title, target.Year, cancellationToken);
        if (tmdbId is not int resolved)
        {
            throw new InvalidOperationException("No TMDb match for this title yet.");
        }

        if (target.TmdbId is null)
        {
            keywords.SaveTmdbId(kind, mediaId, resolved);
        }

        var offer = MapProviders(target.Title, await FetchProvidersAsync(tmdbKind, resolved, cancellationToken));
        Cache[cacheKey] = new CacheEntry(DateTimeOffset.UtcNow.Add(CacheFor), offer);
        return offer;
    }

    private WatchTarget? ReadTarget(string kind, int mediaId)
    {
        var sql = kind switch
        {
            "movie" => "SELECT Title, ReleaseYear, TmdbId FROM Movie WHERE Id = @id",
            "documentary" => "SELECT Title, ReleaseYear, TmdbId FROM Documentary WHERE Id = @id",
            "show" => "SELECT Title, ReleaseYear, TmdbId FROM Show WHERE Id = @id",
            _ => null,
        };
        if (sql is null)
        {
            return null;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("id", mediaId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        return new WatchTarget(
            reader.GetString(0).Trim(),
            reader.IsDBNull(1) ? null : reader.GetInt32(1),
            reader.IsDBNull(2) ? null : reader.GetInt32(2));
    }

    private async Task<int?> ResolveTmdbIdAsync(string tmdbKind, string title, int? year, CancellationToken cancellationToken)
    {
        if (title.Length < 2)
        {
            return null;
        }

        var path = tmdbKind == "tv"
            ? $"/search/tv?query={Uri.EscapeDataString(title)}&include_adult=false"
            : $"/search/movie?query={Uri.EscapeDataString(title)}&include_adult=false";
        if (year is int releaseYear && tmdbKind == "movie")
        {
            path += $"&year={releaseYear}";
        }

        using var document = await GetTmdbAsync(path, cancellationToken);
        if (document is null || !document.RootElement.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var matches = new List<(int Id, int? Year)>();
        foreach (var item in results.EnumerateArray())
        {
            var name = ReadString(item, tmdbKind == "tv" ? "name" : "title");
            if (!string.Equals(name, title, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var id = item.TryGetProperty("id", out var idValue) && idValue.TryGetInt32(out var parsed) ? parsed : 0;
            if (id < 1)
            {
                continue;
            }

            var date = ReadString(item, tmdbKind == "tv" ? "first_air_date" : "release_date");
            matches.Add((id, YearOf(date)));
        }

        var match = year is int wanted
            ? matches.FirstOrDefault(item => item.Year == wanted)
            : default;
        if (match.Id < 1)
        {
            match = matches.FirstOrDefault();
        }

        return match.Id > 0 ? match.Id : null;
    }

    private async Task<JsonDocument?> FetchProvidersAsync(string tmdbKind, int tmdbId, CancellationToken cancellationToken)
    {
        return await GetTmdbAsync($"/{tmdbKind}/{tmdbId}/watch/providers", cancellationToken);
    }

    private async Task<JsonDocument?> GetTmdbAsync(string path, CancellationToken cancellationToken)
    {
        var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("TMDBKey is not configured.");
        }

        var separator = path.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        var url = $"https://api.themoviedb.org/3{path}{separator}api_key={Uri.EscapeDataString(apiKey)}";
        using var response = await Http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
    }

    private static WatchOfferDto MapProviders(string title, JsonDocument? document)
    {
        if (document is null
            || !document.RootElement.TryGetProperty("results", out var results)
            || !results.TryGetProperty(Region, out var region)
            || region.ValueKind != JsonValueKind.Object)
        {
            return new WatchOfferDto(title, Region, null, [], [], [], [], Attribution);
        }

        return new WatchOfferDto(
            title,
            Region,
            ReadString(region, "link"),
            ReadProviders(region, "flatrate"),
            ReadProviders(region, "rent"),
            ReadProviders(region, "buy"),
            ReadProviders(region, "free", "ads"),
            Attribution);
    }

    private static IReadOnlyList<WatchProviderDto> ReadProviders(JsonElement region, params string[] keys)
    {
        var seen = new HashSet<int>();
        var items = new List<(int Priority, WatchProviderDto Provider)>();
        foreach (var key in keys)
        {
            if (!region.TryGetProperty(key, out var array) || array.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var item in array.EnumerateArray())
            {
                var id = item.TryGetProperty("provider_id", out var idValue) && idValue.TryGetInt32(out var parsed) ? parsed : 0;
                var name = ReadString(item, "provider_name");
                if (id < 1 || string.IsNullOrWhiteSpace(name) || !seen.Add(id))
                {
                    continue;
                }

                var priority = item.TryGetProperty("display_priority", out var priorityValue) && priorityValue.TryGetInt32(out var order)
                    ? order
                    : 100;
                items.Add((priority, new WatchProviderDto(name, LogoUrl(ReadString(item, "logo_path")))));
            }
        }

        return items
            .OrderBy(item => item.Priority)
            .Select(item => item.Provider)
            .ToList();
    }

    private static string? LogoUrl(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        return path.StartsWith('/') ? $"https://image.tmdb.org/t/p/w45{path}" : path;
    }

    private static string? ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var text = value.GetString()?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static int? YearOf(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length < 4 || !int.TryParse(value.AsSpan(0, 4), out var year))
        {
            return null;
        }

        return year is >= 1888 and <= 3000 ? year : null;
    }

    private static (string Kind, int MediaId) ParseId(string? id)
    {
        var parts = (id ?? string.Empty).Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[1], out var mediaId) || mediaId < 1)
        {
            throw new InvalidOperationException("That title was not found.");
        }

        var kind = parts[0].ToLowerInvariant();
        return kind is "movie" or "series" or "documentary" or "show" or "book"
            ? (kind, mediaId)
            : throw new InvalidOperationException("That title was not found.");
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

    private sealed record WatchTarget(string Title, int? Year, int? TmdbId);

    private sealed record CacheEntry(DateTimeOffset Expires, WatchOfferDto Offer);
}

public sealed record WatchProviderDto(string Name, string? Logo);

public sealed record WatchOfferDto(
    string Title,
    string Region,
    string? Link,
    IReadOnlyList<WatchProviderDto> Streaming,
    IReadOnlyList<WatchProviderDto> Rent,
    IReadOnlyList<WatchProviderDto> Buy,
    IReadOnlyList<WatchProviderDto> Free,
    string Attribution);
