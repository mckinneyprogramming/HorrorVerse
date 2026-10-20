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
        items.AddRange(ReadBooks());
        items.AddRange(ReadOptionalTable("SELECT Id, Title, Listened, ReleaseYear FROM Podcast", "podcast"));
        items.AddRange(ReadGames());
        return AttachPosters(AttachKeywords(items));
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

    private IReadOnlyList<CatalogItemDto> AttachPosters(IReadOnlyList<CatalogItemDto> items)
    {
        try
        {
            keywords.EnsureSchema();
            var posters = LoadPosters();
            return items
                .Select(item => posters.TryGetValue(item.Id, out var path) ? item with { PosterPath = path } : item)
                .ToList();
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not load catalog posters from PostgreSQL.");
            return items;
        }
    }

    private Dictionary<string, string> LoadPosters()
    {
        var posters = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        using var connection = OpenConnection();
        ReadPosterRows(connection, posters, "SELECT 'movie', Id, PosterPath FROM Movie WHERE PosterPath IS NOT NULL AND PosterPath <> ''");
        ReadPosterRows(
            connection,
            posters,
            """
            SELECT 'series', s.Id, COALESCE(s.PosterPath, (
                SELECT m.PosterPath FROM Movie m
                WHERE m.SeriesId = s.Id AND m.PosterPath IS NOT NULL AND m.PosterPath <> ''
                ORDER BY m.ReleaseYear NULLS LAST, m.Id
                LIMIT 1
            ))
            FROM MovieSeries s
            """);
        ReadPosterRows(connection, posters, "SELECT 'documentary', Id, PosterPath FROM Documentary WHERE PosterPath IS NOT NULL AND PosterPath <> ''");
        try
        {
            ReadPosterRows(connection, posters, "SELECT 'show', Id, PosterPath FROM Show WHERE PosterPath IS NOT NULL AND PosterPath <> ''");
        }
        catch (PostgresException)
        {
            // Show table is created on first TV import.
        }

        return posters;
    }

    private static void ReadPosterRows(NpgsqlConnection connection, Dictionary<string, string> posters, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            if (reader.IsDBNull(2))
            {
                continue;
            }

            var path = reader.GetString(2).Trim();
            if (path.StartsWith('/') && path.Length <= 160 && !path.Contains("..", StringComparison.Ordinal))
            {
                posters[$"{reader.GetString(0)}:{reader.GetInt32(1)}"] = path;
            }
        }
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
            EnsureOptionalTables("show");
            using var connection = new NpgsqlConnection(connectionString);
            connection.Open();
            using var command = new NpgsqlCommand(
                "SELECT Id, Title, Watched, TotalTime, TotalEpisodes, NumberOfSeasons, ReleaseYear FROM Show",
                connection);
            using var reader = command.ExecuteReader();
            var items = new List<CatalogItemDto>();
            while (reader.Read())
            {
                var totalTime = reader.IsDBNull(3) ? 0m : reader.GetDecimal(3);
                var episodes = reader.IsDBNull(4) ? 0 : reader.GetInt32(4);
                var seasons = reader.IsDBNull(5) ? 0 : reader.GetInt32(5);
                var year = reader.FieldCount > 6 && !reader.IsDBNull(6) ? reader.GetInt32(6) : 0;
                items.Add(new CatalogItemDto(
                    $"show:{reader.GetInt32(0)}",
                    reader.GetInt32(0),
                    reader.GetString(1),
                    "show",
                    !reader.IsDBNull(2) && reader.GetBoolean(2),
                    totalTime > 0 ? totalTime : null,
                    year > 0 ? year : null,
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

    private IEnumerable<CatalogItemDto> ReadBooks()
    {
        EnsureOptionalTables("book");
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
                "SELECT Id, Title, Read, ReleaseYear, Pages, Author, Description, CoverUrl, Isbn, Publisher FROM Book",
                connection);
            using var reader = command.ExecuteReader();
            var items = new List<CatalogItemDto>();
            while (reader.Read())
            {
                var mediaId = reader.GetInt32(0);
                var title = reader.GetString(1);
                var completed = !reader.IsDBNull(2) && reader.GetBoolean(2);
                var year = reader.IsDBNull(3) ? 0 : reader.GetInt32(3);
                var pages = reader.IsDBNull(4) ? 0 : Convert.ToInt32(reader.GetValue(4));
                var author = reader.IsDBNull(5) ? null : reader.GetString(5);
                var description = reader.IsDBNull(6) ? null : reader.GetString(6);
                var cover = reader.IsDBNull(7) ? null : reader.GetString(7);
                var isbn = reader.IsDBNull(8) ? null : reader.GetString(8);
                var publisher = reader.IsDBNull(9) ? null : reader.GetString(9);
                if (cover is not null && !System.Text.RegularExpressions.Regex.IsMatch(cover, @"^https://covers\.openlibrary\.org/b/id/\d+-M\.jpg$"))
                {
                    cover = null;
                }

                items.Add(new CatalogItemDto(
                    $"book:{mediaId}",
                    mediaId,
                    title,
                    "book",
                    completed,
                    null,
                    year > 0 ? year : null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    pages > 0 ? pages : null,
                    string.IsNullOrWhiteSpace(author) ? null : author,
                    string.IsNullOrWhiteSpace(description) ? null : description,
                    cover,
                    string.IsNullOrWhiteSpace(isbn) ? null : isbn,
                    string.IsNullOrWhiteSpace(publisher) ? null : publisher));
            }

            return items;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Optional catalog table for {Kind} is unavailable.", "book");
            return [];
        }
    }

    private IEnumerable<CatalogItemDto> ReadGames()
    {
        EnsureOptionalTables("game");
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
                "SELECT Id, Title, Played, ReleaseYear, Description, CoverUrl, Developer, Publisher, Platforms FROM Game",
                connection);
            using var reader = command.ExecuteReader();
            var items = new List<CatalogItemDto>();
            while (reader.Read())
            {
                var mediaId = reader.GetInt32(0);
                var title = reader.GetString(1);
                var completed = !reader.IsDBNull(2) && reader.GetBoolean(2);
                var year = reader.IsDBNull(3) ? 0 : reader.GetInt32(3);
                var description = reader.IsDBNull(4) ? null : reader.GetString(4);
                var cover = reader.IsDBNull(5) ? null : reader.GetString(5);
                var developer = reader.IsDBNull(6) ? null : reader.GetString(6);
                var publisher = reader.IsDBNull(7) ? null : reader.GetString(7);
                var platforms = reader.IsDBNull(8) ? null : reader.GetString(8);
                cover = NormalizeIgdbCover(cover);

                items.Add(new CatalogItemDto(
                    $"game:{mediaId}",
                    mediaId,
                    title,
                    "game",
                    completed,
                    null,
                    year > 0 ? year : null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    string.IsNullOrWhiteSpace(description) ? null : description,
                    cover,
                    null,
                    string.IsNullOrWhiteSpace(publisher) ? null : publisher,
                    string.IsNullOrWhiteSpace(developer) ? null : developer,
                    string.IsNullOrWhiteSpace(platforms) ? null : platforms));
            }

            return items;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Optional catalog table for {Kind} is unavailable.", "game");
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
                var year = reader.FieldCount > 3 && !reader.IsDBNull(3) ? reader.GetInt32(3) : 0;
                items.Add(new CatalogItemDto(
                    $"{kind}:{mediaId}",
                    mediaId,
                    title,
                    kind,
                    completed,
                    null,
                    year > 0 ? year : null));
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
                WHERE lower(Title) = lower(@title) AND COALESCE(ReleaseYear, 0) = @year
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "book" => """
                SELECT Id FROM Book
                WHERE lower(Title) = lower(@title) AND ReleaseYear = @year
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "podcast" => """
                SELECT Id FROM Podcast
                WHERE lower(Title) = lower(@title) AND ReleaseYear = @year
                  AND (@excludeId = 0 OR Id <> @excludeId)
                LIMIT 1
                """,
            "game" => """
                SELECT Id FROM Game
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
        if (kind is "series")
        {
            return 0;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = kind switch
        {
            "movie" => "SELECT ReleaseYear FROM Movie WHERE Id = @id",
            "documentary" => "SELECT ReleaseYear FROM Documentary WHERE Id = @id",
            "show" => "SELECT ReleaseYear FROM Show WHERE Id = @id",
            "book" => "SELECT ReleaseYear FROM Book WHERE Id = @id",
            "podcast" => "SELECT ReleaseYear FROM Podcast WHERE Id = @id",
            "game" => "SELECT ReleaseYear FROM Game WHERE Id = @id",
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
        if (kind is not "show" and not "book" and not "podcast" and not "game")
        {
            return;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = kind switch
        {
            "show" => """
                CREATE TABLE IF NOT EXISTS Show (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    TotalTime DECIMAL(10, 2) NOT NULL,
                    TotalEpisodes INTEGER NOT NULL,
                    NumberOfSeasons INTEGER NOT NULL,
                    Watched BOOLEAN NOT NULL);
                ALTER TABLE Show ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
                ALTER TABLE Show ADD COLUMN IF NOT EXISTS ReleaseYear INTEGER;
                ALTER TABLE Show ADD COLUMN IF NOT EXISTS PosterPath TEXT;
                """,
            "podcast" => """
                CREATE TABLE IF NOT EXISTS Podcast (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    ReleaseYear INTEGER NOT NULL,
                    Listened BOOLEAN NOT NULL)
                """,
            "game" => """
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
                """,
            _ => """
                CREATE TABLE IF NOT EXISTS Book (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    SeriesId INTEGER,
                    Pages INTEGER NOT NULL,
                    PartOfSeries BOOLEAN NOT NULL,
                    ReleaseYear INTEGER NOT NULL,
                    Read BOOLEAN NOT NULL);
                ALTER TABLE Book ADD COLUMN IF NOT EXISTS OpenLibraryId TEXT;
                ALTER TABLE Book ADD COLUMN IF NOT EXISTS Author TEXT;
                ALTER TABLE Book ADD COLUMN IF NOT EXISTS Description TEXT;
                ALTER TABLE Book ADD COLUMN IF NOT EXISTS Isbn TEXT;
                ALTER TABLE Book ADD COLUMN IF NOT EXISTS Publisher TEXT;
                ALTER TABLE Book ADD COLUMN IF NOT EXISTS CoverUrl TEXT;
                """
        };
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
                command.Parameters.AddWithValue("releaseYear", year);
                break;
            case "book":
                command.Parameters.AddWithValue("seriesId", DBNull.Value);
                command.Parameters.AddWithValue("pages", Math.Max(request.Pages ?? 0, 0));
                command.Parameters.AddWithValue("partOfSeries", false);
                command.Parameters.AddWithValue("releaseYear", year);
                break;
            case "podcast":
            case "game":
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
            INSERT INTO Show (Title, TotalTime, TotalEpisodes, NumberOfSeasons, Watched, ReleaseYear)
            VALUES (@title, @totalTime, @totalEpisodes, @numberOfSeasons, @completed, @releaseYear)
            RETURNING Id, Title, Watched
            """,
        "book" => """
            INSERT INTO Book (Title, SeriesId, Pages, PartOfSeries, ReleaseYear, Read)
            VALUES (@title, @seriesId, @pages, @partOfSeries, @releaseYear, @completed)
            RETURNING Id, Title, Read
            """,
        "podcast" => """
            INSERT INTO Podcast (Title, ReleaseYear, Listened)
            VALUES (@title, @releaseYear, @completed)
            RETURNING Id, Title, Listened
            """,
        "game" => """
            INSERT INTO Game (Title, ReleaseYear, Played)
            VALUES (@title, @releaseYear, @completed)
            RETURNING Id, Title, Played
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
        "podcast" => """
            UPDATE Podcast
            SET Title = @title, Listened = @completed
            WHERE Id = @id
            RETURNING Id, Title, Listened
            """,
        "game" => """
            UPDATE Game
            SET Title = @title, Played = @completed
            WHERE Id = @id
            RETURNING Id, Title, Played
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
        "podcast" => "DELETE FROM Podcast WHERE Id = @id",
        "game" => "DELETE FROM Game WHERE Id = @id",
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
        return value is "movie" or "series" or "documentary" or "show" or "book" or "podcast" or "game"
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

    private static string? NormalizeIgdbCover(string? cover)
    {
        if (string.IsNullOrWhiteSpace(cover))
        {
            return null;
        }

        var url = cover.Trim();
        if (System.Text.RegularExpressions.Regex.IsMatch(url, @"^https://images\.igdb\.com/igdb/image/upload/t_cover_big/[A-Za-z0-9_-]+\.jpg$"))
        {
            return url;
        }

        var legacy = System.Text.RegularExpressions.Regex.Match(url, @"^https://images\.igdb\.com/igdb/image/t_cover_big/([A-Za-z0-9_-]+)\.jpg$");
        return legacy.Success
            ? $"https://images.igdb.com/igdb/image/upload/t_cover_big/{legacy.Groups[1].Value}.jpg"
            : null;
    }
}
