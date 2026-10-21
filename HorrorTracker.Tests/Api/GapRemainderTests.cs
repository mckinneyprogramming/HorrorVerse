using System.Net;
using System.Reflection;
using System.Text.Json;
using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Library;
using HorrorTracker.Data.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Tests.Api;

public class GapRemainderTests
{
    [Fact]
    public async Task Remainder_CoversParsersImportsAndVaultEdges()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        await CoverageSupport.EnsureVault(connectionString);

        var movies = new Dictionary<int, string> { [6] = "   ", [7] = "Halloween" };
        Gap.Call(typeof(CatalogService), "MapMovie", new Movie("Orphan", 0, false, null, 0, false, 1), movies);
        Gap.Call(typeof(CatalogService), "MapMovie", new Movie("Zero", 0, true, 0, 0, true, 2), movies);
        Gap.Call(typeof(CatalogService), "MapMovie", new Movie("Missing", 12, true, 5, 1999, false, 3), movies);
        Gap.Call(typeof(CatalogService), "MapMovie", new Movie("Blank", 12, true, 6, 1999, false, 4), movies);
        Gap.Call(typeof(CatalogService), "MapMovie", new Movie("Named", 88, true, 7, 1978, true, 5), movies);

        await using var factory = new WebApplicationFactory<Program>();
        await using var scope = factory.Services.CreateAsyncScope();
        var franchises = scope.ServiceProvider.GetRequiredService<FranchiseCatalogService>();
        var lists = scope.ServiceProvider.GetRequiredService<UserLibraryService>();
        var tmdb = scope.ServiceProvider.GetRequiredService<TmdbCatalogService>();
        var shows = scope.ServiceProvider.GetRequiredService<ShowGuideService>();
        var keywords = scope.ServiceProvider.GetRequiredService<KeywordCatalogService>();
        var games = scope.ServiceProvider.GetRequiredService<IgdbCatalogService>();
        var books = scope.ServiceProvider.GetRequiredService<OpenLibraryCatalogService>();
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(FranchiseCatalogService), "NormalizeName", new object?[] { null }));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(FranchiseCatalogService), "NormalizeName", " "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(FranchiseCatalogService), "NormalizeName", new string('n', 81)));
        Assert.Equal("A", Gap.Call(typeof(FranchiseCatalogService), "NormalizeName", " A "));
        Assert.Equal(new string('n', 80), Gap.Call(typeof(FranchiseCatalogService), "NormalizeName", new string('n', 80)));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(UserLibraryService), "NormalizeListName", new object?[] { null }));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(UserLibraryService), "NormalizeListName", new string('l', 81)));
        Assert.Equal("Ok", Gap.Call(typeof(UserLibraryService), "NormalizeListName", " Ok "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(TmdbCatalogService), "RequireTitle", new object?[] { null }));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(TmdbCatalogService), "RequireTitle", new string('t', 201)));
        Assert.Equal("Title", Gap.Call(typeof(TmdbCatalogService), "RequireTitle", " Title "));
        Assert.Null(Gap.Call(typeof(TmdbCatalogService), "SeriesTitle", new object?[] { null }));
        Assert.Null(Gap.Call(typeof(TmdbCatalogService), "SeriesTitle", "   "));
        Assert.Equal("Halloween", Gap.Call(typeof(TmdbCatalogService), "SeriesTitle", "Halloween Collection"));
        Assert.Equal("Collection", Gap.Call(typeof(TmdbCatalogService), "SeriesTitle", "Collection"));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "ParseId", new object?[] { null }));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "ParseId", "movie"));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "ParseId", "movie:0"));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "ParseId", "movie:nope"));
        Assert.Equal(("movie", 4), Gap.Call(typeof(CatalogService), "ParseId", " Movie : 4 "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "NormalizeKind", new object?[] { null }));
        foreach (var kind in new[] { "movie", "series", "documentary", "show", "book", "podcast", "game" })
        {
            Assert.Equal(kind, Gap.Call(typeof(CatalogService), "NormalizeKind", kind));
        }

        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "NormalizeKind", "comic"));
        Assert.Equal("show", Gap.Call(typeof(CatalogService), "NormalizeKind", " Show "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "NormalizeTitle", " "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "NormalizeTitle", new string('t', 201)));
        Assert.Equal(new string('t', 200), Gap.Call(typeof(CatalogService), "NormalizeTitle", new string('t', 200)));
        Assert.Equal("Named", Gap.Call(typeof(CatalogService), "NormalizeTitle", " Named "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "NormalizeTitle", new object?[] { null }));
        foreach (var raw in new string?[] { null, " ", "99", "abcd", "1000-01-01", "4000-01-01", "1978-10-31" })
        {
            Gap.Call(typeof(WatchCatalogService), "YearOf", raw is null ? new object?[] { null } : [raw]);
        }

        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(WatchCatalogService), "ParseId", new object?[] { null }));
        foreach (var raw in new[] { "movie", "movie:0", "movie:x", "comic:1", "MOVIE:2", "show:3", "book:4", "series:5", "documentary:6" })
        {
            try
            {
                Gap.Call(typeof(WatchCatalogService), "ParseId", raw);
            }
            catch (InvalidOperationException)
            {
            }
        }

        using var watchJson = JsonDocument.Parse("""{"title":"  ","name":1,"overview":"ghost"}""");
        Gap.Call(typeof(WatchCatalogService), "ReadString", watchJson.RootElement, "missing");
        Gap.Call(typeof(WatchCatalogService), "ReadString", watchJson.RootElement, "title");
        Gap.Call(typeof(WatchCatalogService), "ReadString", watchJson.RootElement, "name");
        Gap.Call(typeof(WatchCatalogService), "ReadString", watchJson.RootElement, "overview");
        Gap.Call(typeof(UpcomingCatalogService), "ReadString", watchJson.RootElement, "missing");
        Gap.Call(typeof(UpcomingCatalogService), "ReadString", watchJson.RootElement, "title");
        Gap.Call(typeof(UpcomingCatalogService), "ReadResults", watchJson.RootElement);
        using var upcomingResults = JsonDocument.Parse("""{"results":[]}""");
        using var upcomingBad = JsonDocument.Parse("""{"results":"nope","total_pages":1.5,"id":1.5}""");
        Gap.Call(typeof(UpcomingCatalogService), "ReadResults", upcomingResults.RootElement);
        Gap.Call(typeof(UpcomingCatalogService), "ReadResults", upcomingBad.RootElement);
        Gap.Call(typeof(UpcomingCatalogService), "ReadInt", upcomingBad.RootElement, "missing");
        Gap.Call(typeof(UpcomingCatalogService), "ReadInt", upcomingBad.RootElement, "id");
        Gap.Call(typeof(UpcomingCatalogService), "ReadInt", upcomingResults.RootElement, "id");
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(ShowGuideService), "ParseShowId", "movie:1"));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(ShowGuideService), "ParseShowId", "show:0"));
        Assert.Equal(3, Gap.Call(typeof(ShowGuideService), "ParseShowId", " show : 3 "));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(ShowGuideService), "ParseShowId", new object?[] { null }));
        Assert.Equal(string.Empty, Gap.Call(tmdb, "ReadSeriesTitle", 99999999));

        using var empty = JsonDocument.Parse("{}");
        using var docsText = JsonDocument.Parse("""{"docs":"nope"}""");
        using var docsEmpty = JsonDocument.Parse("""{"docs":[]}""");
        using var docsWork = JsonDocument.Parse("""{"docs":[{"key":null},{"key":"/works/OL9W"},{"key":"OL9W"}]}""");
        using var description = JsonDocument.Parse("""{"description":{"value":null},"covers":"nope","subtitle":null}""");
        using var covers = JsonDocument.Parse("""{"covers":[0,1.5,12],"description":"  "}""");
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "FirstDoc", empty.RootElement));
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "FirstDoc", docsText.RootElement));
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "FirstDoc", docsEmpty.RootElement));
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "CleanDescription", empty.RootElement));
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "CleanDescription", description.RootElement));
        Assert.Equal(string.Empty, Gap.Call(typeof(OpenLibraryCatalogService), "CleanDescription", covers.RootElement) ?? string.Empty);
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "FirstCover", empty.RootElement));
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "FirstCover", description.RootElement));
        Assert.NotNull(Gap.Call(typeof(OpenLibraryCatalogService), "FirstCover", covers.RootElement));
        Assert.Null(Gap.Call(typeof(OpenLibraryCatalogService), "Subtitle", new object?[] { description.RootElement, null }));
        var key = string.Empty;
        var tryWork = typeof(OpenLibraryCatalogService).GetMethod("TryWorkId", BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.False((bool)tryWork.Invoke(null, [docsWork.RootElement.GetProperty("docs")[0], "key", key])!);
        Assert.True((bool)tryWork.Invoke(null, [docsWork.RootElement.GetProperty("docs")[1], "key", key])!);

        using var notArray = JsonDocument.Parse("""{"id":1}""");
        using var emptyArray = JsonDocument.Parse("[]");
        using var gameDoc = JsonDocument.Parse("""{"name":null,"cover":{"image_id":null},"involved_companies":[]}""");
        using var gameFull = JsonDocument.Parse("""{"name":"Haunt","cover":{"image_id":"abc"},"involved_companies":[{"developer":true,"publisher":false,"company":{"name":"Studio"}},{"developer":false,"publisher":true,"company":{"name":"Press"}},{"developer":true,"company":{"name":"   "}}]}""");
        Assert.Null(Gap.Call(typeof(IgdbCatalogService), "First", notArray.RootElement));
        Assert.Null(Gap.Call(typeof(IgdbCatalogService), "First", emptyArray.RootElement));
        Assert.Null(Gap.Call(typeof(IgdbCatalogService), "CoverUrl", gameDoc.RootElement));
        Assert.NotNull(Gap.Call(typeof(IgdbCatalogService), "CoverUrl", gameFull.RootElement));
        Gap.Call(typeof(IgdbCatalogService), "Companies", gameDoc.RootElement);
        Gap.Call(typeof(IgdbCatalogService), "Companies", gameFull.RootElement);
        using var companySides = JsonDocument.Parse("""{"involved_companies":[{"company":{"name":"Solo Dev"},"developer":true},{"company":{"name":"Solo Press"},"publisher":true},{"company":{"name":"Plain"}}]}""");
        Gap.Call(typeof(IgdbCatalogService), "Companies", companySides.RootElement);
        using var horrorKeyword = JsonDocument.Parse("""{"keywords":{"results":[{"id":4,"name":null},{"name":"ghost"},{"id":1.5,"name":"slash"},{"id":3158,"name":"x"}]}}""");
        using var excludedGenres = JsonDocument.Parse("""{"genre_ids":[1.5,35]}""");
        using var missingGenres = JsonDocument.Parse("""{"genre_ids":{"id":35}}""");
        Assert.True((bool)Gap.Call(typeof(UpcomingCatalogService), "HasHorrorKeyword", horrorKeyword.RootElement)!);
        Assert.True((bool)Gap.Call(typeof(UpcomingCatalogService), "HasExcludedTvGenreIds", excludedGenres.RootElement)!);
        Assert.False((bool)Gap.Call(typeof(UpcomingCatalogService), "HasExcludedTvGenreIds", missingGenres.RootElement)!);
        using var workSubtitle = JsonDocument.Parse("""{"subtitle":"The Haunting"}""");
        using var editionSubtitle = JsonDocument.Parse("""{"subtitle":"Edition Note"}""");
        using var noSubtitle = JsonDocument.Parse("{}");
        Assert.Equal("The Haunting", Gap.Call(typeof(OpenLibraryCatalogService), "Subtitle", workSubtitle.RootElement, null));
        Assert.Equal("Edition Note", Gap.Call(typeof(OpenLibraryCatalogService), "Subtitle", noSubtitle.RootElement, editionSubtitle.RootElement));
        Gap.Call(typeof(TmdbCatalogService), "MapDocumentaries", new TMDbLib.Objects.General.SearchContainer<SearchMovie> { Results = null });

        var stamp = Random.Shared.Next(100000, 999999);
        var previousSend = OutboundHttp.Send;
        var previousKey = Environment.GetEnvironmentVariable("TMDBKey");
        var previousFactory = CatalogDb.TmdbClientFactory;
        var script = new ScriptedTmdb();
        CatalogDb.TmdbClientFactory = () => script.Service;
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        OutboundHttp.Send = (request, _) =>
        {
            var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
            if (url.Contains("api.igdb.com", StringComparison.Ordinal))
            {
                if (url.Contains("down", StringComparison.Ordinal))
                {
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
                }

                var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
                if (body.Contains("880009", StringComparison.Ordinal))
                {
                    return Task.FromResult(CoverageSupport.Json("[]"));
                }

                return Task.FromResult(CoverageSupport.Json($"[{{\"id\":{stamp},\"name\":\"Gap Remainder Game {stamp}\"}}]"));
            }

            if (url.Contains("openlibrary.org", StringComparison.Ordinal))
            {
                return Task.FromResult(url.Contains("/works/", StringComparison.Ordinal)
                    ? CoverageSupport.Json($"{{\"title\":\"Gap Remainder Book {stamp}\"}}")
                    : CoverageSupport.Json("""{"docs":[]}"""));
            }

            if (url.Contains("/tv/701", StringComparison.Ordinal))
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
            }

            if (url.Contains("/tv/702", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json("""{"name":"Cooking","overview":"food","genres":[{"id":35}]}"""));
            }

            var soon = DateTime.UtcNow.Date.AddDays(10).ToString("yyyy-MM-dd");
            return Task.FromResult(CoverageSupport.Json("{\"name\":\"Horror Hour\",\"overview\":\"ghost\",\"keywords\":{\"results\":[{\"id\":3158,\"name\":\"x\"},{\"name\":\"ghost\"},{\"id\":4,\"name\":null}]},\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"Wake\",\"season_number\":1.5,\"episode_number\":2}}"));
        };
        try
        {
            CoverageSupport.SetIgdbToken("cached", DateTimeOffset.UtcNow.AddHours(2));
            var directGames = new IgdbCatalogService(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["IGDB_CLIENT_ID"] = "client",
                ["IGDB_CLIENT_SECRET"] = "secret",
                ["ConnectionStrings:HorrorVerse"] = connectionString,
            }).Build());
            await Assert.ThrowsAsync<InvalidOperationException>(() => directGames.ImportAsync(null, CancellationToken.None));
            await Assert.ThrowsAsync<InvalidOperationException>(() => directGames.ImportAsync("880009", CancellationToken.None));
            Assert.NotNull(await directGames.ImportAsync(stamp.ToString(), CancellationToken.None));
            OutboundHttp.Send = (request, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
            await Assert.ThrowsAsync<InvalidOperationException>(() => directGames.SearchAsync("haunt", CancellationToken.None));
            OutboundHttp.Send = (request, _) =>
            {
                var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
                if (url.Contains("openlibrary.org", StringComparison.Ordinal))
                {
                    return Task.FromResult(url.Contains("/works/", StringComparison.Ordinal)
                        ? CoverageSupport.Json($"{{\"title\":\"Gap Remainder Book {stamp}\"}}")
                        : CoverageSupport.Json("""{"docs":[]}"""));
                }

                if (url.Contains("/movie/", StringComparison.Ordinal) && url.Contains("keywords", StringComparison.Ordinal))
                {
                    return Task.FromResult(CoverageSupport.Json("""{"keywords":[{"id":9,"name":"ghost"},{"name":"slash"},{"id":10,"name":null},{"id":11,"name":" "}]}"""));
                }

                return Task.FromResult(CoverageSupport.Json("""{}"""));
            };
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.ImportAsync(null, CancellationToken.None));
            Assert.NotNull(await books.ImportAsync($"OL{stamp}W", CancellationToken.None));

            script.Shows[stamp] = new TvShow { Id = stamp, Name = $"Gap Remainder Show {stamp}", NumberOfEpisodes = 3, NumberOfSeasons = 1, PosterPath = "/show.jpg" };
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "show", TmdbId = stamp }, CancellationToken.None));
            var movieId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, tmdbid, posterpath) VALUES ('Gap Remainder Poster {stamp}', 10, FALSE, 1990, FALSE, {stamp}, NULL) RETURNING id");
            script.Movies[stamp] = new TMDbLib.Objects.Movies.Movie { Id = stamp, Title = "Poster", PosterPath = "/poster.jpg", Runtime = 10 };
            Assert.NotEmpty(await tmdb.PostersForRecentAsync([$"movie:{movieId}", "series:1", "movie:0", "comic:1"], CancellationToken.None));
            script.Movies[stamp] = new TMDbLib.Objects.Movies.Movie { Id = stamp, Title = "Poster", PosterPath = "plain", Runtime = 10 };
            await CoverageSupport.Exec(connectionString, $"UPDATE movie SET posterpath = NULL WHERE id = {movieId}");
            Assert.NotNull(await tmdb.PostersForRecentAsync([$"movie:{movieId}"], CancellationToken.None));

            script.ThrowCollectionSearch = true;
            script.ThrowShowSearch = true;
            Assert.NotNull(await tmdb.SyncAsync(null, true, CancellationToken.None));
            script.ThrowCollectionSearch = false;
            script.ThrowShowSearch = false;

            var soonDate = DateTime.UtcNow.Date.AddDays(10).ToString("yyyy-MM-dd");
            OutboundHttp.Send = (request, _) =>
            {
                var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
                if (url.Contains("/tv/701", StringComparison.Ordinal))
                {
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
                }

                if (url.Contains("/tv/702", StringComparison.Ordinal))
                {
                    return Task.FromResult(CoverageSupport.Json("""{"name":"Cooking","overview":"food","genres":[{"id":35}]}"""));
                }

                return Task.FromResult(CoverageSupport.Json("{\"name\":\"Horror Hour\",\"overview\":\"ghost\",\"keywords\":{\"results\":[{\"id\":3158,\"name\":\"x\"},{\"name\":\"ghost\"},{\"id\":4,\"name\":null}]},\"genres\":[{\"id\":27},{\"id\":1.5},{\"nope\":1}],\"next_episode_to_air\":{\"air_date\":\"" + soonDate + "\",\"name\":\"Wake\",\"season_number\":1,\"episode_number\":2}}"));
            };
            var fetch = typeof(UpcomingCatalogService).GetMethod("FetchNextEpisodesAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            await (Task)fetch.Invoke(null, [new[] { 0, 701, 702, 703 }, DateTime.UtcNow.Date, DateTime.UtcNow.Date.AddDays(40), CancellationToken.None])!;
            var keywordMovie = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries) VALUES ('Gap Remainder Keys {stamp}', 10, FALSE, 1991, FALSE) RETURNING id");
            await keywords.SaveMovieAsync(keywordMovie, stamp, cancellationToken: CancellationToken.None);

            script.Shows[stamp + 1] = new TvShow { Id = stamp + 1, Name = $"Gap Remainder Show Poster {stamp}", PosterPath = "/tv.jpg" };
            var posterShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, tmdbid, posterpath) VALUES ('Gap Remainder Show Poster {stamp}', 1, 1, 1, FALSE, {stamp + 1}, NULL) RETURNING id");
            Assert.NotNull(await tmdb.PostersForRecentAsync([$"show:{posterShow}"], CancellationToken.None));
            Gap.Call(tmdb, "ReadMissingPosters", "SELECT 0, 0 UNION ALL SELECT 1, 0 UNION ALL SELECT 4, 8", "movie");
            script.MovieSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchMovie> { Results = [new SearchMovie { Id = 1, Title = "Doc", GenreIds = [99], ReleaseDate = new DateTime(1999, 1, 1) }, new SearchMovie { Id = 2, Title = "Nope", GenreIds = [28] }] });
            await tmdb.SearchAsync("documentary", "documentary haunt", CancellationToken.None);
            var collections = Enumerable.Range(1, 9).Select(id => new SearchCollection { Id = id, Name = id == 1 ? "   " : $"Set {id}" }).ToList();
            foreach (var id in Enumerable.Range(1, 9))
            {
                script.Collections[id] = new TMDbLib.Objects.Collections.Collection { Id = id, Parts = [new SearchMovie { GenreIds = [27] }] };
            }

            var map = typeof(TmdbCatalogService).GetMethod("MapCollectionsAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            await (Task)map.Invoke(null, [script.Service, new TMDbLib.Objects.General.SearchContainer<SearchCollection> { Results = collections }])!;
            var bareMovie = new TMDbLib.Objects.Movies.Movie { Id = stamp + 2, Title = $"Gap Existing Bare {stamp}", Runtime = 90, ReleaseDate = new DateTime(1981, 1, 1) };
            script.Movies[stamp + 2] = bareMovie;
            await tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = stamp + 2 }, CancellationToken.None);
            await tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = stamp + 2 }, CancellationToken.None);
            OutboundHttp.Send = (_, _) => throw new HttpRequestException("keywords down");
            var taggedMovie = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, tmdbid) VALUES ('Gap Untagged {stamp}', 10, FALSE, 1992, FALSE, 77) RETURNING id");
            var taggedDoc = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO documentary (title, totaltime, watched, releaseyear, tmdbid) VALUES ('Gap Untagged Doc {stamp}', 10, FALSE, 1993, 78) RETURNING id");
            var taggedShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, tmdbid) VALUES ('Gap Untagged Show {stamp}', 10, 1, 1, FALSE, 79) RETURNING id");
            await Gap.CallAsync(tmdb, "RefreshMissingKeywordsAsync", CancellationToken.None, "movie", taggedMovie);
            await Gap.CallAsync(tmdb, "RefreshMissingKeywordsAsync", CancellationToken.None, "documentary", taggedDoc);
            await Gap.CallAsync(tmdb, "RefreshMissingKeywordsAsync", CancellationToken.None, "show", taggedShow);
            OutboundHttp.Send = (_, _) => Task.FromResult(CoverageSupport.Json("""{}"""));
            script.MovieSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchMovie> { Results = [new SearchMovie { Id = 5, Title = $"Gap Resolve {stamp}", ReleaseDate = new DateTime(1980, 1, 1) }] });
            await Gap.CallAsync(tmdb, "ResolveMovieTmdbIdAsync", script.Service, $"Gap Resolve {stamp}", 1999);
            await Gap.CallAsync(tmdb, "ResolveMovieTmdbIdAsync", script.Service, "Q", null);
            script.MovieSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchMovie> { Results = [new SearchMovie { Id = 6, Title = $"Gap Resolve {stamp}", ReleaseDate = new DateTime(1999, 5, 1) }] });
            await Gap.CallAsync(tmdb, "ResolveMovieTmdbIdAsync", script.Service, $"Gap Resolve {stamp}", 1999);
            await Assert.ThrowsAsync<InvalidOperationException>(() => Gap.CallAsync(tmdb, "RefreshSeriesAsync", script.Service, 99999999, CancellationToken.None));
            var fetchTmdb = typeof(UpcomingCatalogService).GetMethod("TryGetTmdbAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            OutboundHttp.Send = (_, _) => throw new HttpRequestException("tmdb down");
            Environment.SetEnvironmentVariable("TMDBKey", "test-key");
            await (Task)fetchTmdb.Invoke(null, ["/movie/1", CancellationToken.None])!;
            OutboundHttp.Send = (_, _) => Task.FromResult(CoverageSupport.Json("""{"id":1,"name":"Horror"}"""));
            await (Task)fetchTmdb.Invoke(null, ["/movie/1", CancellationToken.None])!;
            OutboundHttp.Send = (request, _) =>
            {
                var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
                if (url.Contains("nodocs", StringComparison.Ordinal))
                {
                    return Task.FromResult(CoverageSupport.Json("""{"numFound":0}"""));
                }

                if (url.Contains("keywords", StringComparison.Ordinal))
                {
                    return Task.FromResult(CoverageSupport.Json("""{"keywords":[{"id":1,"name":null},{"id":2},{"name":"ghost"},{"id":3,"name":"haunted"}]}"""));
                }

                return Task.FromResult(CoverageSupport.Json("""
                    {"docs":[
                      {"key":"/works/OL1W","title":"Haunt","subject":["Horror"],"author_name":["Ada"]},
                      {"key":"/works/OL2W","title":"Cookbook","subject":["Cooking"],"author_name":["Bea"]},
                      {"key":"/works/OL3W","title":"Bare"},
                      {"title":null},
                      {"key":null}
                    ]}
                    """));
            };
            Assert.NotNull(await books.SearchAsync("nodocs", CancellationToken.None));
            Assert.NotNull(await books.SearchAsync("horror shelf", CancellationToken.None));
            var fetchKeywords = typeof(KeywordCatalogService).GetMethod("FetchAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
            await (Task)fetchKeywords.Invoke(keywords, ["movie", stamp, CancellationToken.None])!;
            await Assert.ThrowsAsync<InvalidOperationException>(() => tmdb.ProxyPosterAsync(null, null, CancellationToken.None));
            await Gap.CallAsync(tmdb, "RefreshKeywordsForIdAsync", "movie", CancellationToken.None);
            await Gap.CallAsync(tmdb, "RefreshKeywordsForIdAsync", "show:abc", CancellationToken.None);
            var bareSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Parts {stamp}', 0, 0, FALSE) RETURNING id");
            script.Movies[stamp + 70] = new TMDbLib.Objects.Movies.Movie { Id = stamp + 70, Title = null, ReleaseDate = new DateTime(1982, 1, 1) };
            script.Movies[stamp + 71] = new TMDbLib.Objects.Movies.Movie { Id = stamp + 71, Title = null, ReleaseDate = new DateTime(1983, 1, 1) };
            await Gap.CallAsync(tmdb, "ImportCollectionPartsAsync", script.Service, bareSeries, new TMDbLib.Objects.Collections.Collection { Id = stamp, Parts = null }, CancellationToken.None);
            await Gap.CallAsync(
                tmdb,
                "ImportCollectionPartsAsync",
                script.Service,
                bareSeries,
                new TMDbLib.Objects.Collections.Collection
                {
                    Id = stamp,
                    Parts =
                    [
                        new SearchMovie { Id = stamp + 69, Title = "Skip", ReleaseDate = null },
                        new SearchMovie { Id = stamp + 70, Title = null, ReleaseDate = new DateTime(1982, 1, 1) },
                        new SearchMovie { Id = stamp + 71, Title = $"Gap Part {stamp}", ReleaseDate = new DateTime(1983, 1, 1) },
                    ],
                },
                CancellationToken.None);
            script.MovieSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchMovie> { Results = null });
            await Gap.CallAsync(tmdb, "ResolveMovieTmdbIdAsync", script.Service, $"Gap Null Results {stamp}", 1990);
            script.MovieSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchMovie>
            {
                Results =
                [
                    new SearchMovie { Id = 8, Title = null, ReleaseDate = new DateTime(1999, 1, 1) },
                    new SearchMovie { Id = 9, Title = $"Gap Year Miss {stamp}", ReleaseDate = new DateTime(1980, 1, 1) },
                ],
            });
            await Gap.CallAsync(tmdb, "ResolveMovieTmdbIdAsync", script.Service, $"Gap Year Miss {stamp}", 1999);
            var resolveSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Resolve Series {stamp}', 0, 0, FALSE) RETURNING id");
            script.CollectionSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchCollection>
            {
                Results =
                [
                    new SearchCollection { Id = stamp + 80, Name = "   " },
                    new SearchCollection { Id = stamp + 81, Name = $"Gap Resolve Series {stamp}" },
                    new SearchCollection { Id = stamp + 82, Name = $"Gap Resolve Series {stamp} Collection" },
                ],
            });
            script.Collections[stamp + 81] = new TMDbLib.Objects.Collections.Collection { Id = stamp + 81, Parts = [new SearchMovie { GenreIds = [28] }] };
            script.Collections[stamp + 82] = new TMDbLib.Objects.Collections.Collection { Id = stamp + 82, Parts = [new SearchMovie { GenreIds = [27] }] };
            await Gap.CallAsync(tmdb, "ResolveSeriesTmdbIdAsync", script.Service, resolveSeries);
            var boomTmdb = stamp + 90;
            script.FailMovies.Add(boomTmdb);
            var boomMovie = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, tmdbid, posterpath) VALUES ('Gap Poster Boom {stamp}', 10, FALSE, 1994, FALSE, {boomTmdb}, NULL) RETURNING id");
            Assert.NotNull(await tmdb.PostersForRecentAsync([$"movie:{boomMovie}"], CancellationToken.None));
            script.FailMovies.Remove(boomTmdb);
            await CoverageSupport.Exec(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Series Catch {stamp}', 0, 0, FALSE)");
            KeywordCatalogService.BeforeReplaceSeries = _ => throw new InvalidOperationException("series tags down");
            try
            {
                await Gap.CallAsync(tmdb, "RefreshMissingKeywordsAsync", CancellationToken.None, "series", null);
            }
            finally
            {
                KeywordCatalogService.BeforeReplaceSeries = null;
            }

            script.ShowSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchTv>
            {
                Results =
                [
                    new SearchTv { Id = stamp + 3, Name = null },
                    new SearchTv { Id = stamp + 4, Name = $"Gap Bare {stamp}" },
                ],
            });
            await CoverWatchNext(connectionString, lists, shows, stamp, script);
        }
        finally
        {
            OutboundHttp.Send = previousSend;
            Environment.SetEnvironmentVariable("TMDBKey", previousKey);
            CatalogDb.TmdbClientFactory = previousFactory;
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
            KeywordCatalogService.BeforeReplaceSeries = null;
        }
    }

    private static async Task CoverWatchNext(string connectionString, UserLibraryService library, ShowGuideService shows, int stamp, ScriptedTmdb script)
    {
        Gap.Call(shows, "EnsureSchema");
        Gap.Call(library, "EnsureSchema");
        var userId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO app_user (email, display_name, password_hash, is_admin) VALUES ('gap-next-{stamp}@example.test', 'Gap Next', 'x', FALSE) RETURNING id");
        var showId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear, posterpath) VALUES ('Gap Next Specials {stamp}', 0, 1, 1, FALSE, NULL, NULL) RETURNING id");
        var seasonId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({showId}, 0, '') RETURNING id");
        var watched = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({showId}, {seasonId}, 1, 'Pilot', 1) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({showId}, {seasonId}, 2, '   ', 1)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_episode_progress (user_id, episode_id, completed_at) VALUES ({userId}, {watched}, NULL)");

        var namedShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear, posterpath) VALUES ('Gap Next Named {stamp}', 20, 2, 1, FALSE, 1999, '/show.jpg') RETURNING id");
        var namedSeason = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({namedShow}, 2, 'Two') RETURNING id");
        var namedWatched = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({namedShow}, {namedSeason}, 1, 'Cold', 1) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({namedShow}, {namedSeason}, 2, 'Hot', 1)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_episode_progress (user_id, episode_id, completed_at) VALUES ({userId}, {namedWatched}, NOW())");
        Gap.Call(library, "LoadNextEpisodes", userId);

        var seriesId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched, posterpath) VALUES ('Gap Next Series {stamp}', 0, 2, FALSE, NULL) RETURNING id");
        var done = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Next Done {stamp}', 10, FALSE, 1978, TRUE, {seriesId}, '-') RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Next Open {stamp}', 10, FALSE, 0, TRUE, {seriesId}, NULL)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at) VALUES ({userId}, 'movie', {done}, NULL)");
        var datedSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched, posterpath) VALUES ('Gap Next Dated {stamp}', 0, 2, FALSE, '/series.jpg') RETURNING id");
        var datedDone = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Next Dated Done {stamp}', 10, FALSE, 1980, TRUE, {datedSeries}, '/a.jpg') RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Next Dated Open {stamp}', 10, FALSE, 1991, TRUE, {datedSeries}, '/b.jpg')");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at) VALUES ({userId}, 'movie', {datedDone}, NOW())");
        Gap.Call(library, "LoadNextSeriesMovies", userId);
        Gap.Call(library, "SyncSeriesForMovie", userId, done, false, null);
        var linked = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid) VALUES ('Gap Next Linked {stamp}', 10, FALSE, 1988, TRUE, {seriesId}) RETURNING id");
        var zero = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid) VALUES ('Gap Next Zero {stamp}', 10, FALSE, 1988, TRUE, 0) RETURNING id");
        Gap.Call(library, "SyncSeriesForMovie", userId, linked, true, 1990);
        Gap.Call(library, "SyncSeriesForMovie", userId, zero, false, null);
        Assert.Empty((System.Collections.IEnumerable)Gap.Call(library, "ReadWatchNextRows", userId, "SELECT 1 FROM gap_missing_watch", "vault")!);

        var bareShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ('Gap Bare {stamp}', 0, 0, 0, FALSE) RETURNING id");
        var emptySeasonShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ('Gap Empty Season {stamp}', 0, 1, 2, FALSE) RETURNING id");
        var emptySeason = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({emptySeasonShow}, 1, 'One') RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({emptySeasonShow}, 2, 'Empty')");
        var looseEpisode = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({emptySeasonShow}, {emptySeason}, 1, 'Only', 1) RETURNING id");
        var partialShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ('Gap Partial {stamp}', 0, 2, 1, FALSE) RETURNING id");
        var partialSeason = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({partialShow}, 1, 'One') RETURNING id");
        var partialEpisode = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({partialShow}, {partialSeason}, 1, 'A', 1) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({partialShow}, {partialSeason}, 2, 'B', 1)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_episode_progress (user_id, episode_id, completed_at) VALUES ({userId}, {partialEpisode}, NOW())");
        var fullShow = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ('Gap Full Progress {stamp}', 0, 1, 1, FALSE) RETURNING id");
        var fullSeason = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({fullShow}, 1, 'One') RETURNING id");
        var fullEpisode = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({fullShow}, {fullSeason}, 1, 'Only', 1) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_episode_progress (user_id, episode_id, completed_at) VALUES ({userId}, {fullEpisode}, NOW())");
        var user = new AuthUserDto(userId, $"gap-next-{stamp}@example.test", "Gap Next", false);
        var nullSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Next Null Year {stamp}', 0, 2, FALSE) RETURNING id");
        var nullDone = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid) VALUES ('Gap Next Null Done {stamp}', 10, FALSE, 1980, TRUE, {nullSeries}) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"ALTER TABLE movie ALTER COLUMN releaseyear DROP NOT NULL");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Next Null Open {stamp}', 10, FALSE, NULL, TRUE, {nullSeries}, NULL)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at) VALUES ({userId}, 'movie', {nullDone}, NOW())");
        Gap.Call(library, "LoadNextSeriesMovies", userId);
        Assert.NotNull(library.GetProgress(user));
        var posterUserId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO app_user (email, display_name, password_hash, is_admin) VALUES ('gap-poster-{stamp}@example.test', 'Gap Poster', 'x', FALSE) RETURNING id");
        var filledTmdb = stamp + 41;
        script.Movies[filledTmdb] = new TMDbLib.Objects.Movies.Movie { Id = filledTmdb, Title = "Filled", PosterPath = "/filled.jpg", Runtime = 10, ReleaseDate = new DateTime(1990, 1, 1) };
        var filledSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched, posterpath) VALUES ('Gap Filled Series {stamp}', 0, 2, FALSE, NULL) RETURNING id");
        var filledDone = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Filled Done {stamp}', 10, FALSE, 1984, TRUE, {filledSeries}, NULL) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath, tmdbid) VALUES ('Gap Filled Open {stamp}', 10, FALSE, 1985, TRUE, {filledSeries}, NULL, {filledTmdb})");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at) VALUES ({posterUserId}, 'movie', {filledDone}, NOW())");
        var missedSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched, posterpath) VALUES ('Gap Missed Series {stamp}', 0, 2, FALSE, NULL) RETURNING id");
        var missedDone = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Missed Done {stamp}', 10, FALSE, 1986, TRUE, {missedSeries}, NULL) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Missed Open {stamp}', 10, FALSE, 1987, TRUE, {missedSeries}, NULL)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_media_progress (user_id, media_kind, media_id, completed_at) VALUES ({posterUserId}, 'movie', {missedDone}, NOW())");
        Assert.NotNull(library.GetProgress(new AuthUserDto(posterUserId, $"gap-poster-{stamp}@example.test", "Gap Poster", false)));
        Assert.Equal("/kept.jpg", Gap.Call(typeof(UserLibraryService), "HomePoster", "/kept.jpg", "movie:1", new Dictionary<string, string>()));
        Assert.Equal("/found.jpg", Gap.Call(typeof(UserLibraryService), "HomePoster", new object?[] { null, "movie:1", new Dictionary<string, string> { ["movie:1"] = "/found.jpg" } }));
        Assert.Null(Gap.Call(typeof(UserLibraryService), "HomePoster", new object?[] { null, "movie:2", new Dictionary<string, string>() }));
        var filledPoster = await CoverageSupport.Scalar<string>(connectionString, $"SELECT COALESCE(posterpath, '') FROM movie WHERE title = 'Gap Filled Open {stamp}'");
        var missedPoster = await CoverageSupport.Scalar<string>(connectionString, $"SELECT COALESCE(posterpath, '') FROM movie WHERE title = 'Gap Missed Open {stamp}'");
        if (filledPoster != "/filled.jpg" || missedPoster.Length > 0)
        {
            throw new InvalidOperationException($"filled='{filledPoster}' missed='{missedPoster}'");
        }
        await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{bareShow}", Completed = true }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{emptySeasonShow}", Completed = true }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{partialShow}", Completed = true }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{fullShow}", Completed = true }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { SeasonId = emptySeason, Completed = true }, CancellationToken.None);
        Assert.Throws<InvalidOperationException>(() => Gap.Call(shows, "GetEpisodeShowId", 99999991));
        _ = looseEpisode;

        await Gap.WithRenamedTable(connectionString, "show", "show_gap", () =>
        {
            Assert.Empty((System.Collections.IEnumerable)Gap.Call(tmdbStatic(), "ListShowIds")!);
            return Task.CompletedTask;
        });
        await Gap.WithRenamedTable(connectionString, "franchise_item", "franchise_item_gap", () =>
        {
            Assert.Throws<InvalidOperationException>(() => Gap.Call(library, "FranchiseItemCount", 1));
            return Task.CompletedTask;
        });

        static TmdbCatalogService tmdbStatic() =>
            new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:HorrorVerse"] = Environment.GetEnvironmentVariable("HorrorVerseDb") }).Build(), null!, null!, null!);
    }
}
