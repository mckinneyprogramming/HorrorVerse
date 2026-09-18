using HorrorTracker.Data.TMDB;
using Npgsql;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Api.Catalog;

public sealed class TmdbCatalogService(IConfiguration configuration)
{
    private const int MaxResults = 8;

    public async Task<object> SearchAsync(string? kind, string? query, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var normalizedKind = NormalizeTmdbKind(kind);
        var q = (query ?? string.Empty).Trim();
        if (q.Length < 2)
        {
            throw new InvalidOperationException("Enter at least two characters to search TMDb.");
        }

        var tmdb = CreateClient();
        IReadOnlyList<TmdbHit> results = normalizedKind switch
        {
            "series" => MapCollections(await tmdb.SearchCollection(q)),
            "show" => MapShows(await tmdb.SearchTvShow(q)),
            _ => MapMovies(await tmdb.SearchMovie(q)),
        };

        return new { results };
    }

    public async Task<object> ImportAsync(TmdbImportRequest request, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var kind = NormalizeTmdbKind(request.Kind);
        if (request.TmdbId < 1)
        {
            throw new InvalidOperationException("Choose a TMDb title to add.");
        }

        var tmdb = CreateClient();
        var added = kind switch
        {
            "series" => await ImportSeriesAsync(tmdb, request.TmdbId),
            "show" => await ImportShowAsync(tmdb, request.TmdbId),
            "documentary" => await ImportDocumentaryAsync(tmdb, request.TmdbId),
            _ => await ImportMovieAsync(tmdb, request.TmdbId),
        };

        if (added < 1)
        {
            throw new InvalidOperationException("Those titles are already in the vault.");
        }

        return new { added };
    }

    private async Task<int> ImportMovieAsync(MovieDatabaseService tmdb, int tmdbId)
    {
        var movie = await tmdb.GetMovie(tmdbId);
        var title = RequireTitle(movie.Title);
        var year = YearOf(movie.ReleaseDate);
        var runtime = RuntimeOf(movie.Runtime);
        if (MovieExists(title, year))
        {
            var existingId = FindMovieId(title, year);
            var collectionNameForExisting = SeriesTitle(movie.BelongsToCollection?.Name);
            var existingSeriesId = collectionNameForExisting is null ? null : FindSeriesId(collectionNameForExisting);
            if (existingId is int mid && existingSeriesId is int sid)
            {
                AddMovieToListsContainingSeries(sid, mid);
                return 1;
            }

            throw new InvalidOperationException($"“{title}” is already in the vault.");
        }

        int? seriesId = null;
        var collectionName = SeriesTitle(movie.BelongsToCollection?.Name);
        if (collectionName is not null)
        {
            seriesId = FindSeriesId(collectionName);
        }

        var movieId = InsertMovie(title, runtime, seriesId, year);
        if (seriesId is int id)
        {
            AddMovieToListsContainingSeries(id, movieId);
            RefreshSeriesTotals(id);
        }

        return 1;
    }

    private async Task<int> ImportSeriesAsync(MovieDatabaseService tmdb, int collectionId)
    {
        var collection = await tmdb.GetCollection(collectionId);
        var seriesTitle = SeriesTitle(collection.Name) ?? RequireTitle(collection.Name);
        var seriesId = FindSeriesId(seriesTitle);
        var createdSeries = false;
        if (seriesId is null)
        {
            seriesId = InsertSeries(seriesTitle, 0, 0);
            createdSeries = true;
        }

        var added = createdSeries ? 1 : 0;
        foreach (var part in collection.Parts.Where(part => part.ReleaseDate is not null))
        {
            var film = await tmdb.GetMovie(part.Id);
            var title = (film.Title ?? part.Title ?? string.Empty).Trim();
            if (title.Length < 1)
            {
                continue;
            }

            var year = YearOf(film.ReleaseDate) ?? YearOf(part.ReleaseDate);
            var existingId = FindMovieId(title, year);
            if (existingId is int movieId)
            {
                LinkMovieToSeries(movieId, seriesId.Value);
                continue;
            }

            var addedMovieId = InsertMovie(title, RuntimeOf(film.Runtime), seriesId, year);
            AddMovieToListsContainingSeries(seriesId.Value, addedMovieId);
            added++;
        }

        RefreshSeriesTotals(seriesId.Value);
        return added;
    }

    private async Task<int> ImportDocumentaryAsync(MovieDatabaseService tmdb, int tmdbId)
    {
        var movie = await tmdb.GetMovie(tmdbId);
        var title = RequireTitle(movie.Title);
        var year = YearOf(movie.ReleaseDate) ?? DateTime.UtcNow.Year;
        if (DocumentaryExists(title, year))
        {
            throw new InvalidOperationException($"“{title}” is already in the vault.");
        }

        InsertDocumentary(title, RuntimeOf(movie.Runtime), year);
        return 1;
    }

    private async Task<int> ImportShowAsync(MovieDatabaseService tmdb, int tmdbId)
    {
        EnsureShowTable();
        var show = await tmdb.GetTvShow(tmdbId);
        var title = RequireTitle(show.Name);
        if (ShowExists(title))
        {
            throw new InvalidOperationException($"“{title}” is already in the vault.");
        }

        var episodes = Math.Max(show.NumberOfEpisodes, 0);
        var seasons = Math.Max(show.NumberOfSeasons, 0);
        var episodeMinutes = show.EpisodeRunTime?.FirstOrDefault() ?? 0;
        var totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
        InsertShow(title, totalTime, episodes, seasons);
        return 1;
    }

    private static IReadOnlyList<TmdbHit> MapMovies(TMDbLib.Objects.General.SearchContainer<SearchMovie> container)
    {
        return (container.Results ?? [])
            .Take(MaxResults)
            .Select(item => new TmdbHit(
                item.Id,
                item.Title,
                YearOf(item.ReleaseDate),
                TrimOverview(item.Overview)))
            .ToList();
    }

    private static IReadOnlyList<TmdbHit> MapCollections(TMDbLib.Objects.General.SearchContainer<SearchCollection> container)
    {
        return (container.Results ?? [])
            .Take(MaxResults)
            .Select(item => new TmdbHit(
                item.Id,
                SeriesTitle(item.Name) ?? item.Name,
                null,
                TrimOverview(item.Overview)))
            .ToList();
    }

    private static IReadOnlyList<TmdbHit> MapShows(TMDbLib.Objects.General.SearchContainer<SearchTv> container)
    {
        return (container.Results ?? [])
            .Take(MaxResults)
            .Select(item => new TmdbHit(
                item.Id,
                item.Name,
                YearOf(item.FirstAirDate),
                TrimOverview(item.Overview)))
            .ToList();
    }

    private bool MovieExists(string title, int? year) => FindMovieId(title, year) is not null;

    private int? FindMovieId(string title, int? year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM Movie WHERE lower(Title) = lower(@title) AND ReleaseYear = @year LIMIT 1";
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("year", year ?? 0);
        return ToInt(command.ExecuteScalar());
    }

    private int? FindSeriesId(string title)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM MovieSeries WHERE lower(Title) = lower(@title) LIMIT 1";
        command.Parameters.AddWithValue("title", title);
        return ToInt(command.ExecuteScalar());
    }

    private bool DocumentaryExists(string title, int year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM Documentary WHERE lower(Title) = lower(@title) AND ReleaseYear = @year LIMIT 1";
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("year", year);
        return ToInt(command.ExecuteScalar()) is not null;
    }

    private bool ShowExists(string title)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM Show WHERE lower(Title) = lower(@title) LIMIT 1";
        command.Parameters.AddWithValue("title", title);
        try
        {
            return ToInt(command.ExecuteScalar()) is not null;
        }
        catch (PostgresException)
        {
            return false;
        }
    }

    private int InsertMovie(string title, decimal totalTime, int? seriesId, int? year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Movie (Title, TotalTime, PartOfSeries, SeriesId, ReleaseYear, Watched)
            VALUES (@title, @totalTime, @partOfSeries, @seriesId, @year, FALSE)
            RETURNING Id
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("partOfSeries", seriesId.HasValue);
        command.Parameters.AddWithValue("seriesId", seriesId.HasValue ? seriesId.Value : DBNull.Value);
        command.Parameters.AddWithValue("year", year ?? 0);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private void AddMovieToListsContainingSeries(int seriesId, int movieId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO user_list_item (list_id, media_kind, media_id)
                SELECT list_id, 'movie', @movieId
                FROM user_list_item
                WHERE media_kind = 'series' AND media_id = @seriesId
                ON CONFLICT (list_id, media_kind, media_id) DO NOTHING
                """;
            command.Parameters.AddWithValue("movieId", movieId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Personal lists may not exist yet.
        }
    }

    private int InsertSeries(string title, decimal totalTime, int totalMovies)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO MovieSeries (Title, TotalTime, TotalMovies, Watched)
            VALUES (@title, @totalTime, @totalMovies, FALSE)
            RETURNING Id
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("totalMovies", totalMovies);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private void InsertDocumentary(string title, decimal totalTime, int year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Documentary (Title, TotalTime, ReleaseYear, Watched)
            VALUES (@title, @totalTime, @year, FALSE)
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("year", year);
        command.ExecuteNonQuery();
    }

    private void InsertShow(string title, decimal totalTime, int episodes, int seasons)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Show (Title, TotalTime, TotalEpisodes, NumberOfSeasons, Watched)
            VALUES (@title, @totalTime, @episodes, @seasons, FALSE)
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("episodes", episodes);
        command.Parameters.AddWithValue("seasons", seasons);
        command.ExecuteNonQuery();
    }

    private void LinkMovieToSeries(int movieId, int seriesId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE Movie
            SET PartOfSeries = TRUE, SeriesId = @seriesId
            WHERE Id = @id AND (SeriesId IS NULL OR SeriesId = 0)
            """;
        command.Parameters.AddWithValue("seriesId", seriesId);
        command.Parameters.AddWithValue("id", movieId);
        command.ExecuteNonQuery();
    }

    private void RefreshSeriesTotals(int seriesId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE MovieSeries
            SET TotalMovies = (SELECT COUNT(*) FROM Movie WHERE SeriesId = @id),
                TotalTime = COALESCE((SELECT SUM(TotalTime) FROM Movie WHERE SeriesId = @id), 0)
            WHERE Id = @id
            """;
        command.Parameters.AddWithValue("id", seriesId);
        command.ExecuteNonQuery();
    }

    private void EnsureShowTable()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS Show (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                TotalTime DECIMAL(10, 2) NOT NULL,
                TotalEpisodes INTEGER NOT NULL,
                NumberOfSeasons INTEGER NOT NULL,
                Watched BOOLEAN NOT NULL)
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

    private static MovieDatabaseService CreateClient()
    {
        var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("TMDBKey is not configured.");
        }

        return new MovieDatabaseService(new TMDbClientWrapper(apiKey));
    }

    private static string NormalizeTmdbKind(string? kind)
    {
        var value = (kind ?? "movie").Trim().ToLowerInvariant();
        return value is "movie" or "series" or "documentary" or "show"
            ? value
            : throw new InvalidOperationException("TMDb can add movies, series, documentaries, and TV shows.");
    }

    private static string RequireTitle(string? title)
    {
        var value = (title ?? string.Empty).Trim();
        if (value.Length is < 1 or > 200)
        {
            throw new InvalidOperationException("TMDb did not return a usable title.");
        }

        return value;
    }

    private static string? SeriesTitle(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        var trimmed = System.Text.RegularExpressions.Regex.Replace(
            name.Trim(),
            @"\s+Collection$",
            string.Empty,
            System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
        return trimmed.Length > 0 ? trimmed : name.Trim();
    }

    private static int? YearOf(DateTime? date) => date is { Year: >= 1888 and <= 3000 } value ? value.Year : null;

    private static decimal RuntimeOf(int? runtime) => runtime is > 0 ? runtime.Value : 0m;

    private static string? TrimOverview(string? overview)
    {
        var value = (overview ?? string.Empty).Trim();
        if (value.Length <= 180)
        {
            return value.Length > 0 ? value : null;
        }

        return value[..177].TrimEnd() + "…";
    }

    private static int? ToInt(object? value) => value is null or DBNull ? null : Convert.ToInt32(value);

    private sealed record TmdbHit(int TmdbId, string Title, int? Year, string? Overview);
}
