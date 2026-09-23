using HorrorTracker.Data.TMDB;
using Npgsql;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Api.Catalog;

public sealed class TmdbCatalogService(IConfiguration configuration, ShowGuideService shows, KeywordCatalogService keywords, FranchiseCatalogService franchises)
{
    private const int MaxResults = 8;
    private const int MaxCollectionCandidates = 16;
    private const int DocumentaryGenre = 99;
    private static readonly HashSet<int> HorrorAdjacentGenres = [27, 53, 9648, 878, 14, 10765];

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
            "series" => await MapCollectionsAsync(tmdb, await tmdb.SearchCollection(q)),
            "show" => MapShows(await tmdb.SearchTvShow(q)),
            "documentary" => MapDocumentaries(await tmdb.SearchMovie(q)),
            _ => MapMovies(await tmdb.SearchMovie(q)),
        };

        return new { results };
    }

    public async Task<object> ImportAsync(TmdbImportRequest request, CancellationToken cancellationToken)
    {
        var kind = NormalizeTmdbKind(request.Kind);
        if (request.TmdbId < 1)
        {
            throw new InvalidOperationException("Choose a TMDb title to add.");
        }

        var tmdb = CreateClient();
        var imported = kind switch
        {
            "series" => await ImportSeriesAsync(tmdb, request.TmdbId, cancellationToken),
            "show" => await ImportShowAsync(tmdb, request.TmdbId, cancellationToken),
            "documentary" => await ImportDocumentaryAsync(tmdb, request.TmdbId, cancellationToken),
            _ => await ImportMovieAsync(tmdb, request.TmdbId, cancellationToken),
        };

        return new { added = imported.Added, id = imported.Id };
    }

    public async Task<object> SyncAsync(string? id, bool force, CancellationToken cancellationToken)
    {
        EnsureSeriesSchema();
        keywords.EnsureSchema();
        if (!string.IsNullOrWhiteSpace(id))
        {
            var added = await SyncOneAsync(id, cancellationToken);
            await RefreshKeywordsForIdAsync(id, cancellationToken);
            return new { added };
        }

        var tagged = await RefreshMissingKeywordsAsync(cancellationToken);
        if (!force && !IsVaultStale())
        {
            return new { added = tagged, seriesAdded = 0, showsAdded = 0, keywordsAdded = tagged, skipped = tagged == 0 };
        }

        var tmdb = CreateClient();
        var seriesAdded = 0;
        foreach (var seriesId in ListSeriesIds())
        {
            try
            {
                seriesAdded += await RefreshSeriesAsync(tmdb, seriesId, cancellationToken);
            }
            catch
            {
                // Keep refreshing the rest of the vault if one series cannot be matched.
            }
        }

        var showsAdded = 0;
        foreach (var showId in ListShowIds())
        {
            try
            {
                showsAdded += await shows.RefreshFromTmdbAsync(showId, cancellationToken);
            }
            catch
            {
                // Keep refreshing the rest of the vault if one show cannot be matched.
            }
        }

        tagged += await RefreshMissingKeywordsAsync(cancellationToken);
        MarkVaultSynced();
        return new { added = seriesAdded + showsAdded + tagged, seriesAdded, showsAdded, keywordsAdded = tagged };
    }

    private async Task<TmdbImportResult> ImportMovieAsync(MovieDatabaseService tmdb, int tmdbId, CancellationToken cancellationToken)
    {
        var movie = await tmdb.GetMovie(tmdbId);
        var title = RequireTitle(movie.Title);
        var year = YearOf(movie.ReleaseDate);
        var runtime = RuntimeOf(movie.Runtime);
        var collectionName = SeriesTitle(movie.BelongsToCollection?.Name);
        var seriesId = collectionName is null ? null : FindSeriesId(collectionName);
        if (FindMovieId(title, year) is int existingId)
        {
            if (seriesId is int existingSeriesId)
            {
                AddMovieToListsContainingSeries(existingSeriesId, existingId);
                franchises.AddMovieToFranchisesContainingSeries(existingSeriesId, existingId);
            }

            await keywords.SaveMovieAsync(existingId, tmdbId, cancellationToken: cancellationToken);
            return new TmdbImportResult($"movie:{existingId}", 0);
        }

        var movieId = InsertMovie(title, runtime, seriesId, year);
        await keywords.SaveMovieAsync(movieId, tmdbId, cancellationToken: cancellationToken);
        if (seriesId is int id)
        {
            AddMovieToListsContainingSeries(id, movieId);
            franchises.AddMovieToFranchisesContainingSeries(id, movieId);
            InvalidateSeriesCompletion(id);
            RefreshSeriesTotals(id);
            keywords.ReplaceSeriesFromMovies(id);
        }

        return new TmdbImportResult($"movie:{movieId}", 1);
    }

    private async Task<TmdbImportResult> ImportSeriesAsync(MovieDatabaseService tmdb, int collectionId, CancellationToken cancellationToken)
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

        EnsureSeriesSchema();
        SaveSeriesTmdbId(seriesId.Value, collectionId);
        var moviesAdded = await ImportCollectionPartsAsync(tmdb, seriesId.Value, collection, cancellationToken);
        RefreshSeriesTotals(seriesId.Value);
        keywords.ReplaceSeriesFromMovies(seriesId.Value);
        return new TmdbImportResult($"series:{seriesId.Value}", (createdSeries ? 1 : 0) + moviesAdded);
    }

    private async Task<TmdbImportResult> ImportDocumentaryAsync(MovieDatabaseService tmdb, int tmdbId, CancellationToken cancellationToken)
    {
        var movie = await tmdb.GetMovie(tmdbId);
        var title = RequireTitle(movie.Title);
        var year = YearOf(movie.ReleaseDate) ?? DateTime.UtcNow.Year;
        if (FindDocumentaryId(title, year) is int existingId)
        {
            await keywords.SaveDocumentaryAsync(existingId, tmdbId, cancellationToken: cancellationToken);
            return new TmdbImportResult($"documentary:{existingId}", 0);
        }

        var documentaryId = InsertDocumentary(title, RuntimeOf(movie.Runtime), year);
        await keywords.SaveDocumentaryAsync(documentaryId, tmdbId, cancellationToken: cancellationToken);
        return new TmdbImportResult($"documentary:{documentaryId}", 1);
    }

    private async Task<TmdbImportResult> ImportShowAsync(MovieDatabaseService tmdb, int tmdbId, CancellationToken cancellationToken)
    {
        EnsureShowTable();
        var show = await tmdb.GetTvShow(tmdbId);
        var title = RequireTitle(show.Name);
        var year = YearOf(show.FirstAirDate);
        var existingId = FindShowId(tmdbId, title, year);
        var episodes = Math.Max(show.NumberOfEpisodes, 0);
        var seasons = Math.Max(show.NumberOfSeasons, 0);
        var episodeMinutes = show.EpisodeRunTime?.FirstOrDefault() ?? 0;
        var totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
        var showId = existingId ?? InsertShow(title, totalTime, episodes, seasons, year);
        await shows.AttachImportedShowAsync(tmdb, showId, tmdbId, show, cancellationToken);
        await keywords.SaveShowAsync(showId, tmdbId, cancellationToken: cancellationToken);
        return new TmdbImportResult($"show:{showId}", existingId is null ? 1 : 0);
    }

    private static IReadOnlyList<TmdbHit> MapMovies(TMDbLib.Objects.General.SearchContainer<SearchMovie> container)
    {
        return (container.Results ?? [])
            .Where(item => IsHorrorAdjacent(item.GenreIds) && !IsDocumentary(item.GenreIds))
            .Take(MaxResults)
            .Select(item => new TmdbHit(
                item.Id,
                item.Title,
                YearOf(item.ReleaseDate),
                TrimOverview(item.Overview)))
            .ToList();
    }

    private static IReadOnlyList<TmdbHit> MapDocumentaries(TMDbLib.Objects.General.SearchContainer<SearchMovie> container)
    {
        return (container.Results ?? [])
            .Where(item => IsDocumentary(item.GenreIds))
            .Take(MaxResults)
            .Select(item => new TmdbHit(
                item.Id,
                item.Title,
                YearOf(item.ReleaseDate),
                TrimOverview(item.Overview)))
            .ToList();
    }

    private static async Task<IReadOnlyList<TmdbHit>> MapCollectionsAsync(
        MovieDatabaseService tmdb,
        TMDbLib.Objects.General.SearchContainer<SearchCollection> container)
    {
        var hits = new List<TmdbHit>();
        foreach (var item in (container.Results ?? []).Take(MaxCollectionCandidates))
        {
            if (hits.Count >= MaxResults)
            {
                break;
            }

            if (!await CollectionIsHorrorAdjacentAsync(tmdb, item.Id))
            {
                continue;
            }

            hits.Add(new TmdbHit(
                item.Id,
                SeriesTitle(item.Name) ?? item.Name,
                null,
                TrimOverview(item.Overview)));
        }

        return hits;
    }

    private static IReadOnlyList<TmdbHit> MapShows(TMDbLib.Objects.General.SearchContainer<SearchTv> container)
    {
        return (container.Results ?? [])
            .Where(item => IsHorrorAdjacent(item.GenreIds) || IsDocumentary(item.GenreIds))
            .Take(MaxResults)
            .Select(item => new TmdbHit(
                item.Id,
                item.Name,
                YearOf(item.FirstAirDate),
                TrimOverview(item.Overview)))
            .ToList();
    }

    private static async Task<bool> CollectionIsHorrorAdjacentAsync(MovieDatabaseService tmdb, int collectionId)
    {
        try
        {
            var collection = await tmdb.GetCollection(collectionId);
            return collection.Parts?.Any(part => IsHorrorAdjacent(part.GenreIds)) == true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<int> SyncOneAsync(string id, CancellationToken cancellationToken)
    {
        var parts = id.Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[1], out var mediaId) || mediaId < 1)
        {
            throw new InvalidOperationException("Choose a series or show to refresh.");
        }

        if (string.Equals(parts[0], "series", StringComparison.OrdinalIgnoreCase))
        {
            return await RefreshSeriesAsync(CreateClient(), mediaId, cancellationToken);
        }

        if (string.Equals(parts[0], "show", StringComparison.OrdinalIgnoreCase))
        {
            return await shows.RefreshFromTmdbAsync(mediaId, cancellationToken);
        }

        throw new InvalidOperationException("HorrorVerse can refresh series and TV shows from TMDb.");
    }

    private async Task RefreshKeywordsForIdAsync(string id, CancellationToken cancellationToken)
    {
        var parts = id.Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[1], out var mediaId) || mediaId < 1)
        {
            return;
        }

        if (string.Equals(parts[0], "series", StringComparison.OrdinalIgnoreCase))
        {
            await RefreshMissingKeywordsAsync(cancellationToken, "movie");
            keywords.ReplaceSeriesFromMovies(mediaId);
            return;
        }

        if (string.Equals(parts[0], "show", StringComparison.OrdinalIgnoreCase))
        {
            await RefreshMissingKeywordsAsync(cancellationToken, "show", mediaId);
        }
    }

    private async Task<int> RefreshMissingKeywordsAsync(CancellationToken cancellationToken, string? onlyKind = null, int? onlyId = null)
    {
        keywords.EnsureSchema();
        var tmdb = CreateClient();
        var added = 0;
        if (onlyKind is null or "movie")
        {
            foreach (var movie in keywords.ListMovies().Where(item => onlyId is null || item.Id == onlyId.Value))
            {
                try
                {
                    if (keywords.HasAny("movie", movie.Id))
                    {
                        continue;
                    }

                    var tmdbId = movie.TmdbId ?? await ResolveMovieTmdbIdAsync(tmdb, movie.Title, movie.Year);
                    if (tmdbId is not int resolved)
                    {
                        continue;
                    }

                    await keywords.SaveMovieAsync(movie.Id, resolved, cancellationToken: cancellationToken);
                    added++;
                }
                catch
                {
                    // Keep tagging the rest of the vault if one title cannot be matched.
                }
            }
        }

        if (onlyKind is null or "documentary")
        {
            foreach (var documentary in keywords.ListDocumentaries().Where(item => onlyId is null || item.Id == onlyId.Value))
            {
                try
                {
                    if (keywords.HasAny("documentary", documentary.Id))
                    {
                        continue;
                    }

                    var tmdbId = documentary.TmdbId ?? await ResolveMovieTmdbIdAsync(tmdb, documentary.Title, documentary.Year);
                    if (tmdbId is not int resolved)
                    {
                        continue;
                    }

                    await keywords.SaveDocumentaryAsync(documentary.Id, resolved, cancellationToken: cancellationToken);
                    added++;
                }
                catch
                {
                    // Keep tagging the rest of the vault if one title cannot be matched.
                }
            }
        }

        if (onlyKind is null or "show")
        {
            foreach (var show in keywords.ListShows().Where(item => onlyId is null || item.Id == onlyId.Value))
            {
                try
                {
                    if (keywords.HasAny("show", show.Id))
                    {
                        continue;
                    }

                    if (show.TmdbId is not int resolved)
                    {
                        continue;
                    }

                    await keywords.SaveShowAsync(show.Id, resolved, cancellationToken: cancellationToken);
                    added++;
                }
                catch
                {
                    // Keep tagging the rest of the vault if one title cannot be matched.
                }
            }
        }

        if (onlyKind is null or "movie" or "series")
        {
            foreach (var seriesId in keywords.ListSeriesIds())
            {
                try
                {
                    keywords.ReplaceSeriesFromMovies(seriesId);
                }
                catch
                {
                    // Series tags can be rebuilt on the next sync.
                }
            }
        }

        return added;
    }

    private async Task<int?> ResolveMovieTmdbIdAsync(MovieDatabaseService tmdb, string title, int? year)
    {
        if (title.Length < 2)
        {
            return null;
        }

        var results = await tmdb.SearchMovie(title);
        var matches = (results.Results ?? [])
            .Where(item => string.Equals(item.Title?.Trim(), title, StringComparison.OrdinalIgnoreCase))
            .ToList();
        var match = year is int releaseYear
            ? matches.FirstOrDefault(item => YearOf(item.ReleaseDate) == releaseYear) ?? matches.FirstOrDefault()
            : matches.FirstOrDefault();
        return match?.Id;
    }

    private async Task<int> RefreshSeriesAsync(MovieDatabaseService tmdb, int seriesId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        EnsureSeriesSchema();
        if (!SeriesExists(seriesId))
        {
            throw new InvalidOperationException("That series was not found.");
        }

        var collectionId = ReadSeriesTmdbId(seriesId) ?? await ResolveSeriesTmdbIdAsync(tmdb, seriesId);
        if (collectionId is null)
        {
            return 0;
        }

        SaveSeriesTmdbId(seriesId, collectionId.Value);
        var collection = await tmdb.GetCollection(collectionId.Value);
        var added = await ImportCollectionPartsAsync(tmdb, seriesId, collection, cancellationToken);
        RefreshSeriesTotals(seriesId);
        keywords.ReplaceSeriesFromMovies(seriesId);
        return added;
    }

    private async Task<int> ImportCollectionPartsAsync(MovieDatabaseService tmdb, int seriesId, Collection collection, CancellationToken cancellationToken)
    {
        var added = 0;
        foreach (var part in collection.Parts?.Where(part => part.ReleaseDate is not null) ?? [])
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
                LinkMovieToSeries(movieId, seriesId);
                await keywords.SaveMovieAsync(movieId, part.Id, skipIfPresent: true, cancellationToken);
                continue;
            }

            var addedMovieId = InsertMovie(title, RuntimeOf(film.Runtime), seriesId, year);
            AddMovieToListsContainingSeries(seriesId, addedMovieId);
            franchises.AddMovieToFranchisesContainingSeries(seriesId, addedMovieId);
            InvalidateSeriesCompletion(seriesId);
            await keywords.SaveMovieAsync(addedMovieId, part.Id, cancellationToken: cancellationToken);
            added++;
        }

        return added;
    }

    private async Task<int?> ResolveSeriesTmdbIdAsync(MovieDatabaseService tmdb, int seriesId)
    {
        var title = ReadSeriesTitle(seriesId);
        if (title.Length < 2)
        {
            return null;
        }

        foreach (var query in new[] { title, $"{title} Collection" })
        {
            var results = await tmdb.SearchCollection(query);
            foreach (var item in results.Results ?? [])
            {
                var name = SeriesTitle(item.Name) ?? item.Name;
                if (!string.Equals(name, title, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (await CollectionIsHorrorAdjacentAsync(tmdb, item.Id))
                {
                    return item.Id;
                }
            }
        }

        return null;
    }

    private static bool IsHorrorAdjacent(IEnumerable<int>? genreIds) =>
        genreIds is not null && genreIds.Any(HorrorAdjacentGenres.Contains);

    private static bool IsDocumentary(IEnumerable<int>? genreIds) =>
        genreIds is not null && genreIds.Contains(DocumentaryGenre);

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

    private int? FindDocumentaryId(string title, int year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM Documentary WHERE lower(Title) = lower(@title) AND ReleaseYear = @year LIMIT 1";
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("year", year);
        return ToInt(command.ExecuteScalar());
    }

    private int? FindShowId(int tmdbId, string title, int? year)
    {
        using var connection = OpenConnection();
        using var byTmdb = connection.CreateCommand();
        byTmdb.CommandText = "SELECT Id FROM Show WHERE TmdbId = @tmdbId LIMIT 1";
        byTmdb.Parameters.AddWithValue("tmdbId", tmdbId);
        try
        {
            var existing = ToInt(byTmdb.ExecuteScalar());
            if (existing is int)
            {
                return existing;
            }

            using var byTitle = connection.CreateCommand();
            byTitle.CommandText = """
                SELECT Id FROM Show
                WHERE lower(Title) = lower(@title)
                  AND TmdbId IS NULL
                  AND (ReleaseYear IS NULL OR ReleaseYear = 0 OR ReleaseYear = @year)
                LIMIT 1
                """;
            byTitle.Parameters.AddWithValue("title", title);
            byTitle.Parameters.AddWithValue("year", year ?? 0);
            return ToInt(byTitle.ExecuteScalar());
        }
        catch (PostgresException)
        {
            return null;
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

    private int InsertDocumentary(string title, decimal totalTime, int year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Documentary (Title, TotalTime, ReleaseYear, Watched)
            VALUES (@title, @totalTime, @year, FALSE)
            RETURNING Id
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("year", year);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private int InsertShow(string title, decimal totalTime, int episodes, int seasons, int? year)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Show (Title, TotalTime, TotalEpisodes, NumberOfSeasons, Watched, ReleaseYear)
            VALUES (@title, @totalTime, @episodes, @seasons, FALSE, @year)
            RETURNING Id
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("episodes", episodes);
        command.Parameters.AddWithValue("seasons", seasons);
        command.Parameters.AddWithValue("year", year ?? 0);
        return Convert.ToInt32(command.ExecuteScalar());
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

    private void InvalidateSeriesCompletion(int seriesId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                DELETE FROM user_media_progress
                WHERE media_kind = 'series' AND media_id = @seriesId
                """;
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Progress table is created on first signed-in use.
        }
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

    private void EnsureSeriesSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            ALTER TABLE MovieSeries ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            CREATE TABLE IF NOT EXISTS catalog_sync (
                id INTEGER PRIMARY KEY,
                last_synced_at TIMESTAMPTZ NOT NULL);
            """;
        command.ExecuteNonQuery();
    }

    private bool IsVaultStale()
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT last_synced_at FROM catalog_sync WHERE id = 1";
            var value = command.ExecuteScalar();
            return value switch
            {
                DateTime synced => DateTime.UtcNow - synced.ToUniversalTime() > TimeSpan.FromHours(6),
                DateTimeOffset synced => DateTimeOffset.UtcNow - synced.ToUniversalTime() > TimeSpan.FromHours(6),
                _ => true,
            };
        }
        catch (PostgresException)
        {
            return true;
        }
    }

    private void MarkVaultSynced()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO catalog_sync (id, last_synced_at)
            VALUES (1, NOW())
            ON CONFLICT (id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
            """;
        command.ExecuteNonQuery();
    }

    private IReadOnlyList<int> ListSeriesIds()
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

    private IReadOnlyList<int> ListShowIds()
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT Id FROM Show ORDER BY Id";
            using var reader = command.ExecuteReader();
            var ids = new List<int>();
            while (reader.Read())
            {
                ids.Add(reader.GetInt32(0));
            }

            return ids;
        }
        catch (PostgresException)
        {
            return [];
        }
    }

    private bool SeriesExists(int seriesId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM MovieSeries WHERE Id = @id";
        command.Parameters.AddWithValue("id", seriesId);
        return command.ExecuteScalar() is not null;
    }

    private int? ReadSeriesTmdbId(int seriesId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT TmdbId FROM MovieSeries WHERE Id = @id";
        command.Parameters.AddWithValue("id", seriesId);
        return ToInt(command.ExecuteScalar());
    }

    private string ReadSeriesTitle(int seriesId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Title FROM MovieSeries WHERE Id = @id";
        command.Parameters.AddWithValue("id", seriesId);
        return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
    }

    private void SaveSeriesTmdbId(int seriesId, int tmdbId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "UPDATE MovieSeries SET TmdbId = @tmdbId WHERE Id = @id";
        command.Parameters.AddWithValue("tmdbId", tmdbId);
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
                Watched BOOLEAN NOT NULL);
            ALTER TABLE Show ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            ALTER TABLE Show ADD COLUMN IF NOT EXISTS ReleaseYear INTEGER;
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

    private sealed record TmdbImportResult(string Id, int Added);
}
