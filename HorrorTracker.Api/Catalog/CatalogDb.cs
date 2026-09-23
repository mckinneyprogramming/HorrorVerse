using HorrorTracker.Data.TMDB;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

internal static class CatalogDb
{
    public static NpgsqlConnection Open(IConfiguration configuration)
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

    public static MovieDatabaseService CreateTmdbClient()
    {
        var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("TMDBKey is not configured.");
        }

        return new MovieDatabaseService(new TMDbClientWrapper(apiKey));
    }

    public static void EnsureCountAtMost(IConfiguration configuration, string sql, int id, int max, string message)
    {
        using var connection = Open(configuration);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("id", id);
        if (Convert.ToInt64(command.ExecuteScalar()) >= max)
        {
            throw new InvalidOperationException(message);
        }
    }

    public static (string Kind, int MediaId) ParseCatalogId(
        string? id,
        IReadOnlySet<string> allowed,
        string notFound,
        string? invalidKind = null)
    {
        var parts = (id ?? string.Empty).Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[1], out var mediaId) || mediaId < 1)
        {
            throw new InvalidOperationException(notFound);
        }

        var kind = parts[0].ToLowerInvariant();
        if (!allowed.Contains(kind))
        {
            throw new InvalidOperationException(invalidKind ?? notFound);
        }

        return (kind, mediaId);
    }
}
