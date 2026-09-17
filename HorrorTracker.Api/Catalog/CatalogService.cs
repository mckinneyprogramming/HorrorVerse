using HorrorTracker.Data.Models;
using HorrorTracker.Data.Repositories;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed class CatalogService(
    MovieRepository movies,
    MovieSeriesRepository series,
    DocumentaryRepository documentaries,
    IConfiguration configuration,
    ILogger<CatalogService> logger)
{
    public IReadOnlyList<CatalogItemDto> GetAll()
    {
        var items = new List<CatalogItemDto>();
        items.AddRange(Read(() => movies.GetAll().Select(MapMovie), "movies"));
        items.AddRange(Read(() => series.GetAll().Select(MapSeries), "series"));
        items.AddRange(Read(() => documentaries.GetAll().Select(MapDocumentary), "documentaries"));
        items.AddRange(ReadOptionalTable("SELECT Id, Title, Watched FROM Show", "show"));
        items.AddRange(ReadOptionalTable("SELECT Id, Title, Read FROM Book", "book"));
        return items;
    }

    public IReadOnlyList<CatalogItemDto> GetByKind(string kind)
    {
        return GetAll()
            .Where(item => string.Equals(item.Kind, kind, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    private IEnumerable<CatalogItemDto> Read(Func<IEnumerable<CatalogItemDto>> source, string name)
    {
        try
        {
            return source().ToList();
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not load {CatalogName} from PostgreSQL.", name);
            return [];
        }
    }

    private IEnumerable<CatalogItemDto> ReadOptionalTable(string sql, string kind)
    {
        var connectionString = ResolveConnectionString(configuration);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return [];
        }

        try
        {
            using var connection = new NpgsqlConnection(connectionString);
            connection.Open();
            using var command = new NpgsqlCommand(sql, connection);
            using var reader = command.ExecuteReader();

            var items = new List<CatalogItemDto>();
            while (reader.Read())
            {
                var mediaId = reader.GetInt32(0);
                var title = reader.GetString(1);
                var completed = !reader.IsDBNull(2) && reader.GetBoolean(2);
                items.Add(new CatalogItemDto($"{kind}:{mediaId}", mediaId, title, kind, completed));
            }

            return items;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Optional catalog table for {Kind} is unavailable.", kind);
            return [];
        }
    }

    private static CatalogItemDto MapMovie(Movie movie) =>
        new($"movie:{movie.Id}", movie.Id, movie.Title, "movie", movie.Watched);

    private static CatalogItemDto MapSeries(MovieSeries movieSeries) =>
        new($"series:{movieSeries.Id}", movieSeries.Id, movieSeries.Title, "series", movieSeries.Watched);

    private static CatalogItemDto MapDocumentary(Documentary documentary) =>
        new($"documentary:{documentary.Id}", documentary.Id, documentary.Title, "documentary", documentary.Watched);

    internal static string? ResolveConnectionString(IConfiguration configuration)
    {
        var fromEnvironment = Environment.GetEnvironmentVariable("HorrorVerseDb");
        if (!string.IsNullOrWhiteSpace(fromEnvironment))
        {
            return fromEnvironment;
        }

        var fromConfig = configuration.GetConnectionString("HorrorVerse");
        return string.IsNullOrWhiteSpace(fromConfig) ? null : fromConfig;
    }
}
