using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;

namespace HorrorTracker.Api.Catalog;

public sealed class UpcomingCatalogService
{
    private const int HorrorGenre = 27;
    private const int HorrorKeyword = 3158;
    private static readonly HashSet<int> ExcludedTvGenreIds = [35, 10762, 10763, 10764, 10766, 10767];
    private static readonly string[] HorrorKeywordHints = ["horror", "slasher", "supernatural", "ghost", "zombie", "vampire", "haunted", "demonic", "occult"];
    private const int HorizonYears = 2;
    private const int EpisodeHorizonDays = 90;
    private const int MaxPages = 12;
    private const int MaxEpisodePages = 3;
    private const int MaxTvDetails = 48;
    private const string CacheKey = "horror-schedule";
    private static readonly TimeSpan CacheFor = TimeSpan.FromHours(6);
    private static readonly ConcurrentDictionary<string, CacheEntry> Cache = new(StringComparer.Ordinal);
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public async Task<UpcomingScheduleDto> GetAsync(CancellationToken cancellationToken)
    {
        if (!Cache.TryGetValue(CacheKey, out var cached) || cached.Expires <= DateTimeOffset.UtcNow)
        {
            var films = await FetchFilmsAsync(cancellationToken);
            IReadOnlyList<UpcomingTitle> shows;
            try
            {
                shows = await FetchShowsAsync(cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                shows = [];
            }

            cached = new CacheEntry(DateTimeOffset.UtcNow.Add(CacheFor), films, shows);
            Cache[CacheKey] = cached;
        }

        var today = DateTime.UtcNow.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return new UpcomingScheduleDto(
            KeepFrom(cached.Films, today),
            KeepFrom(cached.Shows, today));
    }

    private static IReadOnlyList<UpcomingTitleDto> KeepFrom(IReadOnlyList<UpcomingTitle> items, string today)
    {
        return items
            .Where(item => string.CompareOrdinal(item.ReleaseDate, today) >= 0)
            .Select(ToDto)
            .ToList();
    }

    private static UpcomingTitleDto ToDto(UpcomingTitle item)
    {
        return new UpcomingTitleDto(item.Kind, item.TmdbId, item.Title, item.ReleaseDate, item.Year, item.Overview, item.Detail);
    }

    private static async Task<IReadOnlyList<UpcomingTitle>> FetchFilmsAsync(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var until = today.AddYears(HorizonYears);
        var start = Iso(today);
        var end = Iso(until);
        var films = new List<UpcomingTitle>();
        var seen = new HashSet<int>();
        var pages = 1;

        for (var page = 1; page <= pages && page <= MaxPages; page++)
        {
            var path =
                $"/discover/movie?include_adult=false&include_video=false&language=en-US&page={page}" +
                $"&sort_by=primary_release_date.asc&with_genres={HorrorGenre}" +
                $"&primary_release_date.gte={Uri.EscapeDataString(start)}" +
                $"&primary_release_date.lte={Uri.EscapeDataString(end)}";
            using var document = await GetTmdbAsync(path, cancellationToken);
            if (document is null)
            {
                break;
            }

            var root = document.RootElement;
            pages = ReadPageCount(root, MaxPages);
            foreach (var item in ReadResults(root))
            {
                var tmdbId = ReadId(item);
                var title = ReadString(item, "title");
                var releaseDate = ReadString(item, "release_date");
                if (tmdbId < 1 || string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(releaseDate) || !seen.Add(tmdbId))
                {
                    continue;
                }

                if (!TryDate(releaseDate, out var date) || date.Date < today || date.Date > until)
                {
                    continue;
                }

                films.Add(new UpcomingTitle(
                    "film",
                    tmdbId,
                    title,
                    Iso(date),
                    date.Year,
                    TrimOverview(ReadString(item, "overview")),
                    null));
            }
        }

        return SortTitles(films);
    }

    private static async Task<IReadOnlyList<UpcomingTitle>> FetchShowsAsync(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var until = today.AddYears(HorizonYears);
        var premieres = await FetchShowPremieresAsync(today, until, cancellationToken);
        var episodeIds = await CollectEpisodeShowIdsAsync(today, cancellationToken);
        var episodes = await FetchNextEpisodesAsync(episodeIds, today, until, cancellationToken);
        var premiereDates = episodes
            .Select(item => $"{item.TmdbId}:{item.ReleaseDate}")
            .ToHashSet(StringComparer.Ordinal);
        var merged = premieres
            .Where(item => !premiereDates.Contains($"{item.TmdbId}:{item.ReleaseDate}"))
            .Concat(episodes)
            .ToList();
        return SortTitles(merged);
    }

    private static async Task<IReadOnlyList<UpcomingTitle>> FetchShowPremieresAsync(
        DateTime today,
        DateTime until,
        CancellationToken cancellationToken)
    {
        var start = Iso(today);
        var end = Iso(until);
        var shows = new List<UpcomingTitle>();
        var seen = new HashSet<int>();
        var pages = 1;

        for (var page = 1; page <= pages && page <= MaxPages; page++)
        {
            var path =
                $"/discover/tv?include_adult=false&language=en-US&page={page}" +
                $"&sort_by=first_air_date.asc" +
                $"&first_air_date.gte={Uri.EscapeDataString(start)}" +
                $"&first_air_date.lte={Uri.EscapeDataString(end)}";
            using var document = await GetTmdbAsync(path, cancellationToken);
            if (document is null)
            {
                break;
            }

            var root = document.RootElement;
            pages = ReadPageCount(root, MaxPages);
            foreach (var item in ReadResults(root))
            {
                var tmdbId = ReadId(item);
                var title = ReadString(item, "name");
                var releaseDate = ReadString(item, "first_air_date");
                if (tmdbId < 1 || string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(releaseDate) || !seen.Add(tmdbId) || !LooksLikeHorrorTv(item))
                {
                    continue;
                }

                if (!TryDate(releaseDate, out var date) || date.Date < today || date.Date > until)
                {
                    continue;
                }

                shows.Add(new UpcomingTitle(
                    "show",
                    tmdbId,
                    title,
                    Iso(date),
                    date.Year,
                    TrimOverview(ReadString(item, "overview")),
                    "New series"));
            }
        }

        return shows;
    }

    private static async Task<HashSet<int>> CollectEpisodeShowIdsAsync(DateTime today, CancellationToken cancellationToken)
    {
        var ids = new HashSet<int>();
        var until = today.AddDays(EpisodeHorizonDays);
        await CollectDiscoverIdsAsync(
            $"/discover/tv?include_adult=false&language=en-US" +
            $"&air_date.gte={Uri.EscapeDataString(Iso(today))}" +
            $"&air_date.lte={Uri.EscapeDataString(Iso(until))}",
            MaxEpisodePages,
            ids,
            requireHorror: true,
            cancellationToken);
        await CollectDiscoverIdsAsync("/tv/airing_today?language=en-US", 2, ids, requireHorror: true, cancellationToken);
        await CollectDiscoverIdsAsync("/tv/on_the_air?language=en-US", 2, ids, requireHorror: true, cancellationToken);
        return ids;
    }

    private static async Task CollectDiscoverIdsAsync(
        string path,
        int maxPages,
        HashSet<int> ids,
        bool requireHorror,
        CancellationToken cancellationToken)
    {
        var pages = 1;
        for (var page = 1; page <= pages && page <= maxPages && ids.Count < MaxTvDetails; page++)
        {
            var separator = path.Contains('?', StringComparison.Ordinal) ? "&" : "?";
            using var document = await TryGetTmdbAsync($"{path}{separator}page={page}", cancellationToken);
            if (document is null)
            {
                break;
            }

            var root = document.RootElement;
            pages = ReadPageCount(root, maxPages);
            foreach (var item in ReadResults(root))
            {
                if (requireHorror && !LooksLikeHorrorTv(item))
                {
                    continue;
                }

                var tmdbId = ReadId(item);
                if (tmdbId > 0)
                {
                    ids.Add(tmdbId);
                }
            }
        }
    }

    private static async Task<IReadOnlyList<UpcomingTitle>> FetchNextEpisodesAsync(
        IEnumerable<int> showIds,
        DateTime today,
        DateTime until,
        CancellationToken cancellationToken)
    {
        var ids = showIds.Where(id => id > 0).Distinct().Take(MaxTvDetails).ToList();
            var documents = await Task.WhenAll(ids.Select(id => TryGetTmdbAsync($"/tv/{id}?language=en-US&append_to_response=keywords", cancellationToken)));
        var episodes = new List<UpcomingTitle>();
        for (var index = 0; index < ids.Count; index++)
        {
            using var document = documents[index];
            if (document is null)
            {
                continue;
            }

            var root = document.RootElement;
            if (!IsHorrorTvShow(root))
            {
                continue;
            }

            if (!root.TryGetProperty("next_episode_to_air", out var next) || next.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var airDate = ReadString(next, "air_date");
            var showTitle = ReadString(root, "name");
            if (string.IsNullOrWhiteSpace(showTitle) || !TryDate(airDate, out var date) || date.Date < today || date.Date > until)
            {
                continue;
            }

            var episodeName = ReadString(next, "name");
            var season = ReadInt(next, "season_number");
            var episode = ReadInt(next, "episode_number");
            var overview = TrimOverview(ReadString(next, "overview")) ?? TrimOverview(ReadString(root, "overview"));
            episodes.Add(new UpcomingTitle(
                "episode",
                ids[index],
                showTitle,
                Iso(date),
                date.Year,
                overview,
                FormatEpisodeDetail(season, episode, episodeName)));
        }

        return episodes;
    }

    private static string? FormatEpisodeDetail(int? season, int? episode, string? name)
    {
        var code = season is > 0 && episode is > 0 ? $"S{season} E{episode}" : null;
        if (!string.IsNullOrWhiteSpace(code) && !string.IsNullOrWhiteSpace(name))
        {
            return $"{code} · {name}";
        }

        return code ?? name;
    }

    private static async Task<JsonDocument?> GetTmdbAsync(string path, CancellationToken cancellationToken)
    {
        var document = await TryGetTmdbAsync(path, cancellationToken);
        if (document is null)
        {
            throw new InvalidOperationException("Could not reach TMDb.");
        }

        return document;
    }

    private static async Task<JsonDocument?> TryGetTmdbAsync(string path, CancellationToken cancellationToken)
    {
        var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("TMDBKey is not configured.");
        }

        try
        {
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
        catch (Exception exception) when (exception is not InvalidOperationException and not OperationCanceledException)
        {
            return null;
        }
    }

    private static IEnumerable<JsonElement> ReadResults(JsonElement root)
    {
        if (!root.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return results.EnumerateArray();
    }

    private static int ReadPageCount(JsonElement root, int maxPages)
    {
        if (root.TryGetProperty("total_pages", out var totalPages) && totalPages.TryGetInt32(out var count))
        {
            return Math.Clamp(count, 1, maxPages);
        }

        return 1;
    }

    private static int ReadId(JsonElement item)
    {
        return item.TryGetProperty("id", out var value) && value.TryGetInt32(out var parsed) ? parsed : 0;
    }

    private static int? ReadInt(JsonElement item, string name)
    {
        return item.TryGetProperty(name, out var value) && value.TryGetInt32(out var parsed) ? parsed : null;
    }

    private static bool LooksLikeHorrorTv(JsonElement item)
    {
        if (HasExcludedTvGenreIds(item))
        {
            return false;
        }

        var title = $"{ReadString(item, "name")} {ReadString(item, "overview")}".ToLowerInvariant();
        return HorrorKeywordHints.Any(title.Contains);
    }

    private static bool IsHorrorTvShow(JsonElement root)
    {
        if (HasExcludedTvGenresObject(root))
        {
            return false;
        }

        if (HasHorrorKeyword(root))
        {
            return true;
        }

        var title = $"{ReadString(root, "name")} {ReadString(root, "overview")}".ToLowerInvariant();
        return HorrorKeywordHints.Any(title.Contains);
    }

    private static bool HasHorrorKeyword(JsonElement root)
    {
        if (!root.TryGetProperty("keywords", out var keywords))
        {
            return false;
        }

        var list = keywords.ValueKind == JsonValueKind.Object && keywords.TryGetProperty("results", out var results)
            ? results
            : keywords.ValueKind == JsonValueKind.Object && keywords.TryGetProperty("keywords", out var movieKeywords)
                ? movieKeywords
                : default;
        if (list.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        return list.EnumerateArray().Any(item =>
            (item.TryGetProperty("id", out var id) && id.TryGetInt32(out var keyword) && keyword == HorrorKeyword)
            || HorrorKeywordHints.Any(hint => (ReadString(item, "name") ?? string.Empty).Contains(hint, StringComparison.OrdinalIgnoreCase)));
    }

    private static bool HasExcludedTvGenreIds(JsonElement item)
    {
        if (!item.TryGetProperty("genre_ids", out var ids) || ids.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        return ids.EnumerateArray().Any(value => value.TryGetInt32(out var genre) && ExcludedTvGenreIds.Contains(genre));
    }

    private static bool HasExcludedTvGenresObject(JsonElement root)
    {
        if (!root.TryGetProperty("genres", out var genres) || genres.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        return genres.EnumerateArray().Any(item =>
            item.TryGetProperty("id", out var id) && id.TryGetInt32(out var genre) && ExcludedTvGenreIds.Contains(genre));
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

    private static bool TryDate(string? value, out DateTime date)
    {
        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    private static string Iso(DateTime date)
    {
        return date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static string? TrimOverview(string? overview)
    {
        if (string.IsNullOrWhiteSpace(overview))
        {
            return null;
        }

        return overview.Length <= 400 ? overview : $"{overview[..397].TrimEnd()}…";
    }

    private static IReadOnlyList<UpcomingTitle> SortTitles(IEnumerable<UpcomingTitle> items)
    {
        return items
            .OrderBy(item => item.ReleaseDate)
            .ThenBy(item => item.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private sealed record UpcomingTitle(string Kind, int TmdbId, string Title, string ReleaseDate, int Year, string? Overview, string? Detail);

    private sealed record CacheEntry(DateTimeOffset Expires, IReadOnlyList<UpcomingTitle> Films, IReadOnlyList<UpcomingTitle> Shows);
}
