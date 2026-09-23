using HorrorTracker.Api.Auth;
using HorrorTracker.Data.TMDB;
using Npgsql;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Api.Catalog;

public sealed class ShowGuideService(IConfiguration configuration)
{
    public async Task<object> GetGuideAsync(AuthUserDto user, string? id, int? season, CancellationToken cancellationToken)
    {
        var showId = ParseShowId(id);
        EnsureSchema();
        EnsureShowExists(showId);
        var tmdbId = await EnsureTmdbIdAsync(showId, cancellationToken);
        if (tmdbId is int resolved)
        {
            await RefreshSeasonsAsync(showId, resolved, cancellationToken);
            if (season is int seasonNumber)
            {
                await EnsureEpisodesAsync(showId, resolved, seasonNumber, cancellationToken);
            }
        }

        return LoadGuide(user.Id, showId);
    }

    public async Task<object> SetProgressAsync(AuthUserDto user, ShowProgressRequest request, CancellationToken cancellationToken)
    {
        EnsureSchema();
        int showId;
        if (request.EpisodeId is int episodeId)
        {
            SetEpisodeCompleted(user.Id, episodeId, request.Completed);
            showId = GetEpisodeShowId(episodeId);
        }
        else if (request.SeasonId is int seasonId)
        {
            var season = GetSeasonRef(seasonId);
            showId = season.ShowId;
            var tmdbId = await EnsureTmdbIdAsync(showId, cancellationToken);
            if (tmdbId is int resolved)
            {
                await RefreshSeasonsAsync(showId, resolved, cancellationToken);
                await EnsureEpisodesAsync(showId, resolved, season.SeasonNumber, cancellationToken);
            }

            SetSeasonCompleted(user.Id, seasonId, request.Completed);
        }
        else if (!string.IsNullOrWhiteSpace(request.Id))
        {
            showId = ParseShowId(request.Id);
            await SetShowCompletedAsync(user.Id, showId, request.Completed, cancellationToken);
            return LoadGuide(user.Id, showId);
        }
        else
        {
            throw new InvalidOperationException("Choose a show, season, or episode to mark.");
        }

        SyncShowProgress(user.Id, showId);
        return LoadGuide(user.Id, showId);
    }

    public async Task AttachImportedShowAsync(MovieDatabaseService tmdb, int showId, int tmdbId, TvShow show, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        EnsureSchema();
        SaveTmdbId(showId, tmdbId);
        InsertSeasons(showId, show);
        UpdateShowTotals(showId, show);
        await Task.CompletedTask;
    }

    public async Task<int> RefreshFromTmdbAsync(int showId, CancellationToken cancellationToken)
    {
        EnsureSchema();
        EnsureShowExists(showId);
        var tmdbId = await EnsureTmdbIdAsync(showId, cancellationToken);
        return tmdbId is int resolved
            ? await RefreshSeasonsAsync(showId, resolved, cancellationToken)
            : 0;
    }

    public void PurgeShow(string? id)
    {
        var parts = (id ?? string.Empty).Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !string.Equals(parts[0], "show", StringComparison.OrdinalIgnoreCase) || !int.TryParse(parts[1], out var showId) || showId < 1)
        {
            return;
        }

        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM user_episode_progress
            WHERE episode_id IN (SELECT id FROM show_episode WHERE show_id = @showId);
            DELETE FROM show_episode WHERE show_id = @showId;
            DELETE FROM show_season WHERE show_id = @showId;
            """;
        command.Parameters.AddWithValue("showId", showId);
        try
        {
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Guide tables may not exist yet.
        }
    }

    private object LoadGuide(int userId, int showId)
    {
        var completed = LoadCompletedEpisodeIds(userId, showId);
        var seasons = new List<object>();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT s.id, s.season_number, s.title,
                   (SELECT COUNT(*) FROM show_episode e WHERE e.season_id = s.id) AS episode_count
            FROM show_season s
            WHERE s.show_id = @showId
            ORDER BY s.season_number
            """;
        command.Parameters.AddWithValue("showId", showId);
        using var reader = command.ExecuteReader();
        var seasonRows = new List<(int Id, int Number, string Title, int EpisodeCount)>();
        while (reader.Read())
        {
            seasonRows.Add((reader.GetInt32(0), reader.GetInt32(1), reader.GetString(2), Convert.ToInt32(reader.GetInt64(3))));
        }

        foreach (var season in seasonRows)
        {
            var episodes = LoadEpisodes(season.Id, completed);
            seasons.Add(new
            {
                id = season.Id,
                seasonNumber = season.Number,
                title = season.Title,
                episodeCount = Math.Max(season.EpisodeCount, episodes.Count),
                finishedCount = episodes.Count(episode => episode.Completed),
                loaded = episodes.Count > 0,
                episodes,
            });
        }

        return new { id = $"show:{showId}", showId, seasons };
    }

    private List<EpisodeDto> LoadEpisodes(int seasonId, HashSet<int> completed)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, episode_number, title, runtime, air_date
            FROM show_episode
            WHERE season_id = @seasonId
            ORDER BY episode_number
            """;
        command.Parameters.AddWithValue("seasonId", seasonId);
        using var reader = command.ExecuteReader();
        var episodes = new List<EpisodeDto>();
        while (reader.Read())
        {
            var episodeId = reader.GetInt32(0);
            DateOnly? airDate = reader.IsDBNull(4) ? null : DateOnly.FromDateTime(reader.GetDateTime(4));
            episodes.Add(new EpisodeDto(
                episodeId,
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetDecimal(3),
                airDate?.Year,
                completed.Contains(episodeId)));
        }

        return episodes;
    }

    private HashSet<int> LoadCompletedEpisodeIds(int userId, int showId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT p.episode_id
            FROM user_episode_progress p
            JOIN show_episode e ON e.id = p.episode_id
            WHERE p.user_id = @userId AND e.show_id = @showId
            """;
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("showId", showId);
        using var reader = command.ExecuteReader();
        var ids = new HashSet<int>();
        while (reader.Read())
        {
            ids.Add(reader.GetInt32(0));
        }

        return ids;
    }

    private void SetEpisodeCompleted(int userId, int episodeId, bool completed)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = completed
            ? """
                INSERT INTO user_episode_progress (user_id, episode_id, completed_at)
                VALUES (@userId, @episodeId, NOW())
                ON CONFLICT (user_id, episode_id) DO NOTHING
                """
            : """
                DELETE FROM user_episode_progress
                WHERE user_id = @userId AND episode_id = @episodeId
                """;
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("episodeId", episodeId);
        command.ExecuteNonQuery();
    }

    private void SetSeasonCompleted(int userId, int seasonId, bool completed)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = completed
            ? """
                INSERT INTO user_episode_progress (user_id, episode_id, completed_at)
                SELECT @userId, id, NOW()
                FROM show_episode
                WHERE season_id = @seasonId
                ON CONFLICT (user_id, episode_id) DO NOTHING
                """
            : """
                DELETE FROM user_episode_progress
                WHERE user_id = @userId
                  AND episode_id IN (SELECT id FROM show_episode WHERE season_id = @seasonId)
                """;
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("seasonId", seasonId);
        command.ExecuteNonQuery();
    }

    private async Task SetShowCompletedAsync(int userId, int showId, bool completed, CancellationToken cancellationToken)
    {
        EnsureShowExists(showId);
        if (completed)
        {
            var tmdbId = await EnsureTmdbIdAsync(showId, cancellationToken);
            if (tmdbId is int resolved)
            {
                await RefreshSeasonsAsync(showId, resolved, cancellationToken);
                foreach (var seasonNumber in ListSeasonNumbers(showId))
                {
                    await EnsureEpisodesAsync(showId, resolved, seasonNumber, cancellationToken);
                }
            }
        }

        SetAllShowEpisodes(userId, showId, completed);
        SyncShowProgress(userId, showId);
    }

    private void SetAllShowEpisodes(int userId, int showId, bool completed)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = completed
            ? """
                INSERT INTO user_episode_progress (user_id, episode_id, completed_at)
                SELECT @userId, id, NOW()
                FROM show_episode
                WHERE show_id = @showId
                ON CONFLICT (user_id, episode_id) DO NOTHING
                """
            : """
                DELETE FROM user_episode_progress
                WHERE user_id = @userId
                  AND episode_id IN (SELECT id FROM show_episode WHERE show_id = @showId)
                """;
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("showId", showId);
        command.ExecuteNonQuery();
    }

    private IReadOnlyList<int> ListSeasonNumbers(int showId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT season_number FROM show_season WHERE show_id = @showId ORDER BY season_number";
        command.Parameters.AddWithValue("showId", showId);
        using var reader = command.ExecuteReader();
        var numbers = new List<int>();
        while (reader.Read())
        {
            numbers.Add(reader.GetInt32(0));
        }

        return numbers;
    }

    private void SyncShowProgress(int userId, int showId)
    {
        using var connection = OpenConnection();
        using var totals = connection.CreateCommand();
        totals.CommandText = """
            SELECT
                (SELECT COUNT(*) FROM show_episode WHERE show_id = @showId) AS total,
                (SELECT COUNT(*) FROM show_season s
                 WHERE s.show_id = @showId
                   AND NOT EXISTS (SELECT 1 FROM show_episode e WHERE e.season_id = s.id)) AS missing,
                (SELECT COUNT(*) FROM user_episode_progress p
                 JOIN show_episode e ON e.id = p.episode_id
                 WHERE p.user_id = @userId AND e.show_id = @showId) AS finished
            """;
        totals.Parameters.AddWithValue("showId", showId);
        totals.Parameters.AddWithValue("userId", userId);
        using var reader = totals.ExecuteReader();
        if (!reader.Read())
        {
            return;
        }

        var total = Convert.ToInt32(reader.GetInt64(0));
        var missing = Convert.ToInt32(reader.GetInt64(1));
        var finished = Convert.ToInt32(reader.GetInt64(2));
        reader.Close();
        var complete = total > 0 && missing == 0 && finished >= total;
        using var progress = connection.CreateCommand();
        progress.CommandText = complete
            ? """
                INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at)
                VALUES (@userId, 'show', @showId, NOW())
                ON CONFLICT (user_id, media_kind, media_id)
                DO UPDATE SET completed_at = EXCLUDED.completed_at
                """
            : """
                DELETE FROM user_media_progress
                WHERE user_id = @userId AND media_kind = 'show' AND media_id = @showId
                """;
        progress.Parameters.AddWithValue("userId", userId);
        progress.Parameters.AddWithValue("showId", showId);
        try
        {
            progress.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Progress table is created on first signed-in use.
        }
    }

    private async Task<int?> EnsureTmdbIdAsync(int showId, CancellationToken cancellationToken)
    {
        var existing = ReadTmdbId(showId);
        if (existing is int)
        {
            return existing;
        }

        var title = ReadShowTitle(showId);
        var year = ReadShowYear(showId);
        var tmdb = CreateClient();
        var results = await tmdb.SearchTvShow(title);
        var sameTitle = (results.Results ?? [])
            .Where(item => string.Equals(item.Name?.Trim(), title, StringComparison.OrdinalIgnoreCase))
            .ToList();
        var match = (year is int airYear
                ? sameTitle.FirstOrDefault(item => item.FirstAirDate?.Year == airYear)
                : null)
            ?? sameTitle.FirstOrDefault()
            ?? (results.Results ?? []).FirstOrDefault();
        if (match is null)
        {
            return null;
        }

        SaveTmdbId(showId, match.Id);
        return match.Id;
    }

    private async Task<int> RefreshSeasonsAsync(int showId, int tmdbId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var before = ListSeasonNumbers(showId);
        var show = await CreateClient().GetTvShow(tmdbId);
        InsertSeasons(showId, show);
        UpdateShowTotals(showId, show);
        var added = ListSeasonNumbers(showId).Except(before).Count();
        if (added > 0)
        {
            InvalidateShowCompletion(showId);
        }

        return added;
    }

    private async Task EnsureEpisodesAsync(int showId, int tmdbId, int seasonNumber, CancellationToken cancellationToken)
    {
        var seasonId = FindSeasonId(showId, seasonNumber);
        if (seasonId is null)
        {
            await RefreshSeasonsAsync(showId, tmdbId, cancellationToken);
            seasonId = FindSeasonId(showId, seasonNumber);
        }

        if (seasonId is null)
        {
            return;
        }

        var before = EpisodeCount(seasonId.Value);
        var season = await CreateClient().GetTvSeason(tmdbId, seasonNumber);
        InsertEpisodes(showId, seasonId.Value, season);
        if (EpisodeCount(seasonId.Value) > before)
        {
            InvalidateShowCompletion(showId);
        }
    }

    private void UpdateShowTotals(int showId, TvShow show)
    {
        var episodes = Math.Max(show.NumberOfEpisodes, 0);
        var seasons = Math.Max(show.NumberOfSeasons, 0);
        var episodeMinutes = show.EpisodeRunTime?.FirstOrDefault() ?? 0;
        var totalTime = episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE Show
            SET TotalEpisodes = @episodes, NumberOfSeasons = @seasons, TotalTime = @totalTime,
                ReleaseYear = COALESCE(NULLIF(@year, 0), ReleaseYear)
            WHERE Id = @id
            """;
        command.Parameters.AddWithValue("episodes", episodes);
        command.Parameters.AddWithValue("seasons", seasons);
        command.Parameters.AddWithValue("totalTime", totalTime);
        command.Parameters.AddWithValue("year", show.FirstAirDate is { Year: >= 1888 and <= 3000 } date ? date.Year : 0);
        command.Parameters.AddWithValue("id", showId);
        command.ExecuteNonQuery();
    }

    private void InvalidateShowCompletion(int showId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                DELETE FROM user_media_progress
                WHERE media_kind = 'show' AND media_id = @showId
                """;
            command.Parameters.AddWithValue("showId", showId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Progress table is created on first signed-in use.
        }
    }

    private void InsertSeasons(int showId, TvShow show)
    {
        foreach (var season in show.Seasons ?? [])
        {
            var number = season.SeasonNumber;
            var title = string.IsNullOrWhiteSpace(season.Name)
                ? number == 0 ? "Specials" : $"Season {number}"
                : season.Name.Trim();
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO show_season (show_id, season_number, title)
                VALUES (@showId, @number, @title)
                ON CONFLICT (show_id, season_number) DO UPDATE SET title = EXCLUDED.title
                """;
            command.Parameters.AddWithValue("showId", showId);
            command.Parameters.AddWithValue("number", number);
            command.Parameters.AddWithValue("title", title);
            command.ExecuteNonQuery();
        }
    }

    private void InsertEpisodes(int showId, int seasonId, TvSeason season)
    {
        foreach (var episode in season.Episodes ?? [])
        {
            var number = episode.EpisodeNumber;
            if (number < 1)
            {
                continue;
            }

            var title = string.IsNullOrWhiteSpace(episode.Name) ? $"Episode {number}" : episode.Name.Trim();
            var runtime = episode.Runtime is > 0 ? episode.Runtime.Value : 0m;
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime, air_date)
                VALUES (@showId, @seasonId, @number, @title, @runtime, @airDate)
                ON CONFLICT (season_id, episode_number) DO UPDATE
                SET title = EXCLUDED.title, runtime = EXCLUDED.runtime, air_date = EXCLUDED.air_date
                """;
            command.Parameters.AddWithValue("showId", showId);
            command.Parameters.AddWithValue("seasonId", seasonId);
            command.Parameters.AddWithValue("number", number);
            command.Parameters.AddWithValue("title", title);
            command.Parameters.AddWithValue("runtime", runtime);
            command.Parameters.AddWithValue("airDate", episode.AirDate ?? (object)DBNull.Value);
            command.ExecuteNonQuery();
        }
    }

    private void EnsureSchema()
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
            CREATE TABLE IF NOT EXISTS show_season (
                id SERIAL PRIMARY KEY,
                show_id INTEGER NOT NULL,
                season_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                UNIQUE (show_id, season_number));
            CREATE TABLE IF NOT EXISTS show_episode (
                id SERIAL PRIMARY KEY,
                show_id INTEGER NOT NULL,
                season_id INTEGER NOT NULL,
                episode_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                runtime DECIMAL(10, 2) NOT NULL DEFAULT 0,
                air_date DATE,
                UNIQUE (season_id, episode_number));
            CREATE TABLE IF NOT EXISTS user_episode_progress (
                user_id INTEGER NOT NULL,
                episode_id INTEGER NOT NULL,
                completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, episode_id));
            """;
        command.ExecuteNonQuery();
    }

    private void EnsureShowExists(int showId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM Show WHERE Id = @id";
        command.Parameters.AddWithValue("id", showId);
        if (command.ExecuteScalar() is null)
        {
            throw new InvalidOperationException("That show was not found.");
        }
    }

    private int? ReadTmdbId(int showId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT TmdbId FROM Show WHERE Id = @id";
        command.Parameters.AddWithValue("id", showId);
        var value = command.ExecuteScalar();
        return value is null or DBNull ? null : Convert.ToInt32(value);
    }

    private string ReadShowTitle(int showId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Title FROM Show WHERE Id = @id";
        command.Parameters.AddWithValue("id", showId);
        return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
    }

    private int? ReadShowYear(int showId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT ReleaseYear FROM Show WHERE Id = @id";
        command.Parameters.AddWithValue("id", showId);
        var value = command.ExecuteScalar();
        if (value is null or DBNull)
        {
            return null;
        }

        var year = Convert.ToInt32(value);
        return year is >= 1888 and <= 3000 ? year : null;
    }

    private void SaveTmdbId(int showId, int tmdbId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "UPDATE Show SET TmdbId = @tmdbId WHERE Id = @id";
        command.Parameters.AddWithValue("tmdbId", tmdbId);
        command.Parameters.AddWithValue("id", showId);
        command.ExecuteNonQuery();
    }

    private int EpisodeCount(int seasonId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM show_episode WHERE season_id = @seasonId";
        command.Parameters.AddWithValue("seasonId", seasonId);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private int? FindSeasonId(int showId, int seasonNumber)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT id FROM show_season WHERE show_id = @showId AND season_number = @number";
        command.Parameters.AddWithValue("showId", showId);
        command.Parameters.AddWithValue("number", seasonNumber);
        var value = command.ExecuteScalar();
        return value is null or DBNull ? null : Convert.ToInt32(value);
    }

    private (int ShowId, int SeasonNumber) GetSeasonRef(int seasonId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT show_id, season_number FROM show_season WHERE id = @id";
        command.Parameters.AddWithValue("id", seasonId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("That season was not found.");
        }

        return (reader.GetInt32(0), reader.GetInt32(1));
    }

    private int GetEpisodeShowId(int episodeId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT show_id FROM show_episode WHERE id = @id";
        command.Parameters.AddWithValue("id", episodeId);
        var value = command.ExecuteScalar();
        return value is null or DBNull
            ? throw new InvalidOperationException("That episode was not found.")
            : Convert.ToInt32(value);
    }

    private NpgsqlConnection OpenConnection() => CatalogDb.Open(configuration);

    private static MovieDatabaseService CreateClient() => CatalogDb.CreateTmdbClient();

    private static int ParseShowId(string? id)
    {
        var parts = (id ?? string.Empty).Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !string.Equals(parts[0], "show", StringComparison.OrdinalIgnoreCase) || !int.TryParse(parts[1], out var showId) || showId < 1)
        {
            throw new InvalidOperationException("That show was not found.");
        }

        return showId;
    }

    private sealed record EpisodeDto(int Id, int EpisodeNumber, string Title, decimal Runtime, int? Year, bool Completed);
}
