using HorrorTracker.Data.Models;
using HorrorTracker.Data.Repositories;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed class CatalogService(
    MovieRepository movies,
    MovieSeriesRepository series,
    DocumentaryRepository documentaries,
    KeywordCatalogService keywords,
    IConfiguration configuration,
    ILogger<CatalogService> logger)
{
    public IReadOnlyList<CatalogItemDto> GetAll()
    {
        var seriesList = Read(() => series.GetAll(), "series").ToList();
        var seriesTitles = seriesList.ToDictionary(item => item.Id, item => item.Title);

        var items = new List<CatalogItemDto>();
        items.AddRange(Read(() => movies.GetAll().Select(movie => MapMovie(movie, seriesTitles)), "movies"));
        items.AddRange(seriesList.Select(MapSeries));
        items.AddRange(Read(() => documentaries.GetAll().Select(MapDocumentary), "documentaries"));
        items.AddRange(ReadShows());
        items.AddRange(ReadOptionalTable("SELECT Id, Title, Read FROM Book", "book"));
        return AttachKeywords(items);
    }

    public IReadOnlyList<CatalogItemDto> GetByKind(string kind)
    {
        return GetAll()
            .Where(item => string.Equals(item.Kind, kind, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public CatalogItemDto Create(CatalogWriteRequest request)
    {
        var kind = NormalizeKind(request.Kind);
        var title = NormalizeTitle(request.Title);
        EnsureOptionalTables(kind);
        EnsureUniqueTitle(kind, title, WriteYear(request));
        return ExecuteReturning(InsertSql(kind), kind, command =>
        {
            AddWriteParameters(command, kind, title, request);
        });
    }

    public CatalogItemDto Update(CatalogWriteRequest request)
    {
        var (kind, mediaId) = ParseId(request.Id);
        var title = NormalizeTitle(request.Title);
        EnsureOptionalTables(kind);
        EnsureUniqueTitle(kind, title, CurrentYear(kind, mediaId), mediaId);
        return ExecuteReturning(UpdateSql(kind), kind, command =>
        {
            command.Parameters.AddWithValue("title", title);
            command.Parameters.AddWithValue("completed", request.Completed);
            command.Parameters.AddWithValue("id", mediaId);
        });
    }

    public void Delete(string? id)
    {
        var (kind, mediaId) = ParseId(id);
        EnsureOptionalTables(kind);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = DeleteSql(kind);
        command.Parameters.AddWithValue("id", mediaId);
        if (command.ExecuteNonQuery() < 1)
        {
            throw new InvalidOperationException("That title was not found.");
        }

        keywords.DeleteFor(kind, mediaId);
    }

    private IReadOnlyList<CatalogItemDto> AttachKeywords(List<CatalogItemDto> items)
    {
        IReadOnlyDictionary<string, IReadOnlyList<string>> tags;
        try
        {
            tags = keywords.LoadAll();
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not load catalog keywords from PostgreSQL.");
            return items;
        }

        return items
            .Select(item => tags.TryGetValue(item.Id, out var names) ? item with { Keywords = names } : item)
            .ToList();
    }

    private IEnumerable<T> Read<T>(Func<IEnumerable<T>> source, string name)
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

    private IEnumerable<CatalogItemDto> ReadShows()
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
            using var command = new NpgsqlCommand(
                "SELECT Id, Title, Watched, TotalTime, TotalEpisodes, NumberOfSeasons FROM Show",
                connection);
            using var reader = command.ExecuteReader();
            var items = new List<CatalogItemDto>();
            while (reader.Read())
            {
                var totalTime = reader.IsDBNull(3) ? 0m : reader.GetDecimal(3);
                var episodes = reader.IsDBNull(4) ? 0 : reader.GetInt32(4);
                var seasons = reader.IsDBNull(5) ? 0 : reader.GetInt32(5);
                items.Add(new CatalogItemDto(
                    $"show:{reader.GetInt32(0)}",
                    reader.GetInt32(0),
                    reader.GetString(1),
                    "show",
                    !reader.IsDBNull(2) && reader.GetBoolean(2),
                    totalTime > 0 ? totalTime : null,
                    null,
                    null,
                    null,
                    episodes > 0 ? episodes : null,
                    seasons > 0 ? seasons : null));
            }

            return items;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Optional catalog table for {Kind} is unavailable.", "show");
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

    private static CatalogItemDto MapMovie(Movie movie, IReadOnlyDictionary<int, string> seriesTitles)
    {
        string? seriesTitle = null;
        if (movie.SeriesId is > 0 && seriesTitles.TryGetValue(movie.SeriesId.Value, out var name) && !string.IsNullOrWhiteSpace(name))
        {
            seriesTitle = name;
        }

        return new(
            $"movie:{movie.Id}",
            movie.Id,
            movie.Title,
            "movie",
            movie.Watched,
            movie.TotalTime > 0 ? movie.TotalTime : null,
            movie.ReleaseYear > 0 ? movie.ReleaseYear : null,
            movie.SeriesId is > 0 ? movie.SeriesId : null,
            seriesTitle);
    }

    private static CatalogItemDto MapSeries(MovieSeries movieSeries) =>
        new($"series:{movieSeries.Id}", movieSeries.Id, movieSeries.Title, "series", movieSeries.Watched);

    private static CatalogItemDto MapDocumentary(Documentary documentary) =>
        new(
            $"documentary:{documentary.Id}",
            documentary.Id,
            documentary.Title,
            "documentary",
            documentary.Watched,
            documentary.TotalTime > 0 ? documentary.TotalTime : null,
            documentary.ReleaseYear > 0 ? documentary.ReleaseYear : null);

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

    private CatalogItemDto ExecuteReturning(string sql, string kind, Action<NpgsqlCommand> bind)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        bind(command);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("Could not save that title.");
        }

        var mediaId = reader.GetInt32(0);
        return new CatalogItemDto($"{kind}:{mediaId}", mediaId, reader.GetString(1), kind, reader.GetBoolean(2));
    }

    private void EnsureUniqueTitle(string kind, string title, int year, int? excludeId = null)
    {
        if (FindExistingId(kind, title, year, excludeId) is not null)
        {
            throw new InvalidOperationException("That title is already in the catalog.");
        }
    }

    private int? FindExistingId(string kind, string title, int year, int? excludeId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = kind switch
        {
            "movie" => """
                SELECT Id FROM Movie
                WHERE lower(Title) = lower(@title) AND ReleaseYear = @year
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "series" => """
                SELECT Id FROM MovieSeries
                WHERE lower(Title) = lower(@title)
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "documentary" => """
                SELECT Id FROM Documentary
                WHERE lower(Title) = lower(@title) AND ReleaseYear = @year
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "show" => """
                SELECT Id FROM Show
                WHERE lower(Title) = lower(@title)
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "book" => """
                SELECT Id FROM Book
                WHERE lower(Title) = lower(@title) AND ReleaseYear = @year
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            _ => throw new InvalidOperationException("That type cannot be stored yet.")
        };
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("year", year);
        command.Parameters.AddWithValue("excludeId", excludeId ?? 0);
        try
        {
            var value = command.ExecuteScalar();
            return value is null or DBNull ? null : Convert.ToInt32(value);
        }
        catch (PostgresException)
        {
            return null;
        }
    }

    private int CurrentYear(string kind, int mediaId)
    {
        if (kind is "series" or "show")
        {
            return 0;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = kind switch
        {
            "movie" => "SELECT ReleaseYear FROM Movie WHERE Id = @id",
            "documentary" => "SELECT ReleaseYear FROM Documentary WHERE Id = @id",
            "book" => "SELECT ReleaseYear FROM Book WHERE Id = @id",
            _ => throw new InvalidOperationException("That type cannot be stored yet.")
        };
        command.Parameters.AddWithValue("id", mediaId);
        try
        {
            var value = command.ExecuteScalar();
            return value is null or DBNull ? 0 : Convert.ToInt32(value);
        }
        catch (PostgresException)
        {
            return 0;
        }
    }

    private static int WriteYear(CatalogWriteRequest request) =>
        request.ReleaseYear is > 0 and <= 3000 ? request.ReleaseYear.Value : DateTime.UtcNow.Year;

    private void EnsureOptionalTables(string kind)
    {
        if (kind is not "show" and not "book")
        {
            return;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = kind == "show"
            ? """
                CREATE TABLE IF NOT EXISTS Show (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    TotalTime DECIMAL(10, 2) NOT NULL,
                    TotalEpisodes INTEGER NOT NULL,
                    NumberOfSeasons INTEGER NOT NULL,
                    Watched BOOLEAN NOT NULL)
                """
            : """
                CREATE TABLE IF NOT EXISTS Book (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    SeriesId INTEGER,
                    Pages INTEGER NOT NULL,
                    PartOfSeries BOOLEAN NOT NULL,
                    ReleaseYear INTEGER NOT NULL,
                    Read BOOLEAN NOT NULL)
                """;
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection OpenConnection()
    {
        var connectionString = ResolveConnectionString(configuration);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("DATABASE_URL is not configured.");
        }

        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static void AddWriteParameters(
        NpgsqlCommand command,
        string kind,
        string title,
        CatalogWriteRequest request)
    {
        var year = request.ReleaseYear is > 0 and <= 3000 ? request.ReleaseYear.Value : DateTime.UtcNow.Year;
        var totalTime = request.TotalTime is >= 0 ? request.TotalTime.Value : 0m;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("completed", request.Completed);

        switch (kind)
        {
            case "movie":
                command.Parameters.AddWithValue("totalTime", totalTime);
                command.Parameters.AddWithValue("partOfSeries", false);
                command.Parameters.AddWithValue("seriesId", DBNull.Value);
                command.Parameters.AddWithValue("releaseYear", year);
                break;
            case "series":
                command.Parameters.AddWithValue("totalTime", totalTime);
                command.Parameters.AddWithValue("totalMovies", Math.Max(request.TotalMovies ?? 0, 0));
                break;
            case "documentary":
                command.Parameters.AddWithValue("totalTime", totalTime);
                command.Parameters.AddWithValue("releaseYear", year);
                break;
            case "show":
                command.Parameters.AddWithValue("totalTime", totalTime);
                command.Parameters.AddWithValue("totalEpisodes", Math.Max(request.TotalEpisodes ?? 0, 0));
                command.Parameters.AddWithValue("numberOfSeasons", Math.Max(request.NumberOfSeasons ?? 0, 0));
                break;
            case "book":
                command.Parameters.AddWithValue("seriesId", DBNull.Value);
                command.Parameters.AddWithValue("pages", Math.Max(request.Pages ?? 0, 0));
                command.Parameters.AddWithValue("partOfSeries", false);
                command.Parameters.AddWithValue("releaseYear", year);
                break;
        }
    }

    private static string InsertSql(string kind) => kind switch
    {
        "movie" => """
            INSERT INTO Movie (Title, TotalTime, PartOfSeries, SeriesId, ReleaseYear, Watched)
            VALUES (@title, @totalTime, @partOfSeries, @seriesId, @releaseYear, @completed)
            RETURNING Id, Title, Watched
            """,
        "series" => """
            INSERT INTO MovieSeries (Title, TotalTime, TotalMovies, Watched)
            VALUES (@title, @totalTime, @totalMovies, @completed)
            RETURNING Id, Title, Watched
            """,
        "documentary" => """
            INSERT INTO Documentary (Title, TotalTime, ReleaseYear, Watched)
            VALUES (@title, @totalTime, @releaseYear, @completed)
            RETURNING Id, Title, Watched
            """,
        "show" => """
            INSERT INTO Show (Title, TotalTime, TotalEpisodes, NumberOfSeasons, Watched)
            VALUES (@title, @totalTime, @totalEpisodes, @numberOfSeasons, @completed)
            RETURNING Id, Title, Watched
            """,
        "book" => """
            INSERT INTO Book (Title, SeriesId, Pages, PartOfSeries, ReleaseYear, Read)
            VALUES (@title, @seriesId, @pages, @partOfSeries, @releaseYear, @completed)
            RETURNING Id, Title, Read
            """,
        _ => throw new InvalidOperationException("That type cannot be stored yet.")
    };

    private static string UpdateSql(string kind) => kind switch
    {
        "movie" => """
            UPDATE Movie
            SET Title = @title, Watched = @completed
            WHERE Id = @id
            RETURNING Id, Title, Watched
            """,
        "series" => """
            UPDATE MovieSeries
            SET Title = @title, Watched = @completed
            WHERE Id = @id
            RETURNING Id, Title, Watched
            """,
        "documentary" => """
            UPDATE Documentary
            SET Title = @title, Watched = @completed
            WHERE Id = @id
            RETURNING Id, Title, Watched
            """,
        "show" => """
            UPDATE Show
            SET Title = @title, Watched = @completed
            WHERE Id = @id
            RETURNING Id, Title, Watched
            """,
        "book" => """
            UPDATE Book
            SET Title = @title, Read = @completed
            WHERE Id = @id
            RETURNING Id, Title, Read
            """,
        _ => throw new InvalidOperationException("That type cannot be stored yet.")
    };

    private static string DeleteSql(string kind) => kind switch
    {
        "movie" => "DELETE FROM Movie WHERE Id = @id",
        "series" => "DELETE FROM MovieSeries WHERE Id = @id",
        "documentary" => "DELETE FROM Documentary WHERE Id = @id",
        "show" => "DELETE FROM Show WHERE Id = @id",
        "book" => "DELETE FROM Book WHERE Id = @id",
        _ => throw new InvalidOperationException("That type cannot be stored yet.")
    };

    private static (string Kind, int MediaId) ParseId(string? id)
    {
        var parts = (id ?? string.Empty).Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[1], out var mediaId) || mediaId < 1)
        {
            throw new InvalidOperationException("That title was not found.");
        }

        return (NormalizeKind(parts[0]), mediaId);
    }

    private static string NormalizeKind(string? kind)
    {
        var value = (kind ?? string.Empty).Trim().ToLowerInvariant();
        return value is "movie" or "series" or "documentary" or "show" or "book"
            ? value
            : throw new InvalidOperationException("That type cannot be stored yet.");
    }

    private static string NormalizeTitle(string? title)
    {
        var value = (title ?? string.Empty).Trim();
        if (value.Length is < 1 or > 200)
        {
            throw new InvalidOperationException("Enter a title.");
        }

        return value;
    }
}
