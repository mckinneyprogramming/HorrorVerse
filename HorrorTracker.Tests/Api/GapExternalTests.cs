using System.Net;
using System.Reflection;
using System.Text.Json;
using TMDbLib.Objects.Movies;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Data.TMDB;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Tests.Api;

public class GapExternalTests
{
    [Fact]
    public async Task Tmdb_CoversImportSyncPostersAndSearchEdges()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        var previousKey = Environment.GetEnvironmentVariable("TMDBKey");
        var previousFactory = CatalogDb.TmdbClientFactory;
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        var script = new ScriptedTmdb();
        CatalogDb.TmdbClientFactory = () => script.Service;
        await using var factory = new WebApplicationFactory<Program>();
        await using var scope = factory.Services.CreateAsyncScope();
        var tmdb = scope.ServiceProvider.GetRequiredService<TmdbCatalogService>();
        var stamp = Guid.NewGuid().ToString("N")[..8];
        try
        {
            script.MovieSearches.Enqueue(new SearchContainer<SearchMovie> { Results = null });
            script.ShowSearches.Enqueue(new SearchContainer<SearchTv> { Results = null });
            script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = null });
            Assert.NotNull(await tmdb.SearchAsync(null, "ab", CancellationToken.None));
            Assert.NotNull(await tmdb.SearchAsync("show", "ab", CancellationToken.None));
            Assert.NotNull(await tmdb.SearchAsync("series", "ab", CancellationToken.None));
            script.MovieSearches.Enqueue(Movies());
            Assert.NotNull(await tmdb.SearchAsync("documentary", "haunt", CancellationToken.None));
            script.MovieSearches.Enqueue(Movies());
            Assert.NotNull(await tmdb.SearchAsync("movie", "haunt", CancellationToken.None));
            script.ShowSearches.Enqueue(Shows());
            Assert.NotNull(await tmdb.SearchAsync("show", "haunt", CancellationToken.None));
            var collections = new List<SearchCollection>();
            for (var id = 1; id <= 18; id++)
            {
                collections.Add(new SearchCollection { Id = 700 + id, Name = id % 2 == 0 ? $"Set {id} Collection" : "   ", Overview = id == 2 ? null : "overview" });
                script.Collections[700 + id] = new Collection
                {
                    Id = 700 + id,
                    Name = $"Set {id}",
                    Parts = id % 3 == 0 ? null : [new SearchMovie { Id = id, GenreIds = id % 2 == 0 ? [27] : [35] }],
                };
            }

            script.FailCollections.Add(706);
            script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = collections });
            Assert.NotNull(await tmdb.SearchAsync("series", "set", CancellationToken.None));
            Assert.Throws<InvalidOperationException>(() => tmdb.SearchAsync("comic", "ab", CancellationToken.None).GetAwaiter().GetResult());
            Assert.Throws<InvalidOperationException>(() => tmdb.SearchAsync("movie", null, CancellationToken.None).GetAwaiter().GetResult());
            Assert.Throws<InvalidOperationException>(() => tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = 0 }, CancellationToken.None).GetAwaiter().GetResult());

            var seriesName = $"Gap Tmdb Series {stamp}";
            script.Movies[801] = new Movie
            {
                Id = 801,
                Title = $"Gap Existing {stamp}",
                Runtime = 90,
                ReleaseDate = new DateTime(1988, 1, 1),
                PosterPath = "/exist.jpg",
                BelongsToCollection = new SearchCollection { Name = seriesName + " Collection" },
            };
            await CoverageSupport.Exec(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('{seriesName}', 0, 0, FALSE)");
            await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries) VALUES ('Gap Existing {stamp}', 80, FALSE, 1988, FALSE)");
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = 801 }, CancellationToken.None));
            script.Movies[802] = new Movie { Id = 802, Title = $"Gap Fresh {stamp}", Runtime = null, ReleaseDate = null, PosterPath = "nope" };
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = 802 }, CancellationToken.None));
            script.Movies[803] = new Movie { Id = 803, Title = " ", Runtime = 10, ReleaseDate = new DateTime(1800, 1, 1) };
            Assert.Throws<InvalidOperationException>(() => tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = 803 }, CancellationToken.None).GetAwaiter().GetResult());

            script.Movies[811] = new Movie { Id = 811, Title = $"Gap Doc {stamp}", Runtime = 40, ReleaseDate = new DateTime(2011, 2, 2), PosterPath = "/doc.jpg" };
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "documentary", TmdbId = 811 }, CancellationToken.None));
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "documentary", TmdbId = 811 }, CancellationToken.None));
            script.Shows[821] = new TvShow { Id = 821, Name = $"Gap Show {stamp}", NumberOfEpisodes = 1, NumberOfSeasons = 1, FirstAirDate = new DateTime(2014, 1, 1), PosterPath = "/show.jpg", Seasons = [] };
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "show", TmdbId = 821 }, CancellationToken.None));
            await CoverageSupport.Exec(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ('Gap Show Title {stamp}', 0, 0, 0, FALSE, 2015)");
            script.Shows[822] = new TvShow { Id = 822, Name = $"Gap Show Title {stamp}", NumberOfEpisodes = 0, NumberOfSeasons = 0, FirstAirDate = null, PosterPath = null, Seasons = null };
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "show", TmdbId = 822 }, CancellationToken.None));

            script.Collections[830] = new Collection
            {
                Id = 830,
                Name = $"Gap Collection {stamp} Collection",
                PosterPath = "/col.jpg",
                Parts =
                [
                    new SearchMovie { Id = 831, Title = "Skip", ReleaseDate = null },
                    new SearchMovie { Id = 832, Title = " ", ReleaseDate = new DateTime(1980, 1, 1) },
                    new SearchMovie { Id = 802, Title = $"Gap Fresh {stamp}", ReleaseDate = new DateTime(1981, 1, 1) },
                    new SearchMovie { Id = 833, Title = $"Gap Part {stamp}", ReleaseDate = new DateTime(1982, 1, 1) },
                ],
            };
            script.Movies[831] = new Movie { Id = 831, Title = null, ReleaseDate = null };
            script.Movies[832] = new Movie { Id = 832, Title = " ", ReleaseDate = new DateTime(1980, 1, 1) };
            script.Movies[833] = new Movie { Id = 833, Title = $"Gap Part {stamp}", Runtime = 10, ReleaseDate = new DateTime(1982, 5, 1), PosterPath = "/part.jpg" };
            Assert.NotNull(await tmdb.ImportAsync(new TmdbImportRequest { Kind = "series", TmdbId = 830 }, CancellationToken.None));
            script.Collections[831] = new Collection { Id = 831, Name = "   ", PosterPath = null, Parts = null };
            Assert.Throws<InvalidOperationException>(() => tmdb.ImportAsync(new TmdbImportRequest { Kind = "series", TmdbId = 831 }, CancellationToken.None).GetAwaiter().GetResult());

            await Gap.WithRenamedColumn(connectionString, "show", "releaseyear", "releaseyear_gap", () =>
            {
                Gap.Call(tmdb, "FindShowId", 999001, $"Gap Show Title {stamp}", 2015);
                return Task.CompletedTask;
            });
            await Gap.WithRenamedTable(connectionString, "user_list_item", "user_list_item_gap", async () =>
            {
                script.Movies[834] = new Movie { Id = 834, Title = $"Gap List Movie {stamp}", Runtime = 11, ReleaseDate = new DateTime(1983, 1, 1), PosterPath = "/l.jpg", BelongsToCollection = new SearchCollection { Name = seriesName } };
                await tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = 834 }, CancellationToken.None);
            });
            await Gap.WithRenamedTable(connectionString, "user_media_progress", "user_media_progress_gap", async () =>
            {
                script.Movies[835] = new Movie { Id = 835, Title = $"Gap Progress Movie {stamp}", Runtime = 11, ReleaseDate = new DateTime(1984, 1, 1), PosterPath = "/p.jpg", BelongsToCollection = new SearchCollection { Name = seriesName } };
                await tmdb.ImportAsync(new TmdbImportRequest { Kind = "movie", TmdbId = 835 }, CancellationToken.None);
            });

            var shortSeries = await CoverageSupport.Scalar<int>(connectionString, "INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Q', 0, 0, FALSE) RETURNING id");
            Assert.NotNull(await tmdb.SyncAsync($"series:{shortSeries}", false, CancellationToken.None));
            script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = [new SearchCollection { Id = 840, Name = "Nope Collection" }] });
            script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = null });
            var namedSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Resolve {stamp}', 0, 0, FALSE) RETURNING id");
            script.Collections[840] = new Collection { Id = 840, Parts = [new SearchMovie { GenreIds = [35] }] };
            Assert.NotNull(await tmdb.SyncAsync($"series:{namedSeries}", false, CancellationToken.None));
            script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = [new SearchCollection { Id = 841, Name = $"Gap Resolve {stamp}" }] });
            script.Collections[841] = new Collection { Id = 841, Name = $"Gap Resolve {stamp}", Parts = [new SearchMovie { GenreIds = [27] }], PosterPath = null };
            Assert.NotNull(await tmdb.SyncAsync($"series:{namedSeries}", true, CancellationToken.None));
            Assert.Throws<InvalidOperationException>(() => tmdb.SyncAsync("movie:1", false, CancellationToken.None).GetAwaiter().GetResult());
            Assert.Throws<InvalidOperationException>(() => tmdb.SyncAsync("series:0", false, CancellationToken.None).GetAwaiter().GetResult());
            await tmdb.SyncAsync($"show:{await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM show ORDER BY id DESC LIMIT 1")}", false, CancellationToken.None);
            script.FailShows.Add(821);
            await tmdb.SyncAsync(null, true, CancellationToken.None);
            await CoverageSupport.Exec(connectionString, "UPDATE catalog_sync SET last_synced_at = NOW() WHERE id = 1");
            await tmdb.SyncAsync(null, false, CancellationToken.None);
            await CoverageSupport.Exec(connectionString, "UPDATE catalog_sync SET last_synced_at = NOW() - INTERVAL '2 days' WHERE id = 1");
            await tmdb.SyncAsync(null, false, CancellationToken.None);
            await Gap.WithRenamedTable(connectionString, "catalog_sync", "catalog_sync_gap", () =>
            {
                Assert.True((bool)Gap.Call(tmdb, "IsVaultStale")!);
                return Task.CompletedTask;
            });
            Assert.Equal(string.Empty, Gap.Call(tmdb, "ReadSeriesTitle", 99999999));

            var posterMovie = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, tmdbid, posterpath) VALUES ('Gap Poster {stamp}', 1, FALSE, 1990, FALSE, 850, NULL) RETURNING id");
            var posterMovieTwo = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, tmdbid, posterpath) VALUES ('Gap Poster Two {stamp}', 1, FALSE, 1991, FALSE, 851, '') RETURNING id");
            script.Movies[850] = new Movie { Id = 850, PosterPath = "bad" };
            script.Movies[851] = new Movie { Id = 851, PosterPath = "/ok.jpg" };
            script.FailMovies.Add(851);
            await Gap.CallAsync(tmdb, "FillMissingPostersAsync", CancellationToken.None);
            script.FailMovies.Remove(851);
            script.MovieDelay = TimeSpan.FromSeconds(21);
            script.MovieDelayUses = 1;
            await Gap.CallAsync(tmdb, "FillMissingPostersAsync", new CancellationToken(true));
            await Gap.CallAsync(tmdb, "FillMissingPostersAsync", CancellationToken.None);
            script.MovieDelayUses = 0;
            await tmdb.PostersForRecentAsync([$"/movie:{posterMovie}", "series:1", "nope", "book:1", $"movie:{posterMovieTwo}"], new CancellationToken(true));
            script.MovieDelay = TimeSpan.FromSeconds(9);
            script.MovieDelayUses = 1;
            await tmdb.PostersForRecentAsync([$"movie:{posterMovie}", $"movie:{posterMovieTwo}"], CancellationToken.None);
            await Gap.WithRenamedTable(connectionString, "movieseries", "movieseries_gap", () =>
            {
                Gap.Call(tmdb, "SiblingMoviePoster", "movie", posterMovie);
                Gap.Call(tmdb, "SiblingMoviePoster", "show", posterMovie);
                return Task.CompletedTask;
            });
            Gap.Call(tmdb, "ReadTmdbAndPoster", "Movie", 99999999);
            Gap.Call(tmdb, "ReadTmdbAndPoster", "Missing", 1);
            Assert.Empty((System.Collections.IEnumerable)Gap.Call(tmdb, "ListMissingPosters", "missing_table", "movie")!);
            Gap.Call(tmdb, "WritePosterValue", "comic", 1, "/x.jpg");
            Gap.Call(tmdb, "WritePosterValue", "movie", 0, "/x.jpg");
            await Gap.WithRenamedColumn(connectionString, "movie", "posterpath", "posterpath_gap", () =>
            {
                Gap.Call(tmdb, "WritePosterValue", "movie", posterMovie, "/x.jpg");
                return Task.CompletedTask;
            });
            await Gap.CallAsync(tmdb, "RefreshKeywordsForIdAsync", "movie:0", CancellationToken.None);
            await Gap.CallAsync(tmdb, "RefreshKeywordsForIdAsync", $"series:{namedSeries}", CancellationToken.None);
        }
        finally
        {
            CatalogDb.TmdbClientFactory = previousFactory;
            Environment.SetEnvironmentVariable("TMDBKey", previousKey);
        }
    }

    [Fact]
    public async Task Upcoming_CoversDiscoverEpisodesAndDates()
    {
        if (!CoverageSupport.Ready(out _))
        {
            return;
        }

        var previousKey = Environment.GetEnvironmentVariable("TMDBKey");
        var previousSend = OutboundHttp.Send;
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        var mode = "full";
        OutboundHttp.Send = (request, _) =>
        {
            var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
            if (mode == "boom" && url.Contains("/discover/tv", StringComparison.Ordinal))
            {
                throw new HttpRequestException("boom");
            }

            if (mode == "cancel" && url.Contains("/discover/tv", StringComparison.Ordinal))
            {
                throw new OperationCanceledException();
            }

            if (mode == "down")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
            }

            return Task.FromResult(CoverageSupport.Json(UpcomingBody(url)));
        };
        try
        {
            CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
            var upcoming = new UpcomingCatalogService();
            var schedule = await upcoming.GetAsync(CancellationToken.None);
            Assert.Contains(schedule.Films, item => item.Kind == "film");
            Assert.Contains(schedule.Shows, item => item.Kind is "show" or "episode");
            CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
            mode = "boom";
            Assert.NotNull(await upcoming.GetAsync(CancellationToken.None));
            CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
            mode = "down";
            Assert.NotNull(await upcoming.GetAsync(CancellationToken.None));
            CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
            mode = "cancel";
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => upcoming.GetAsync(CancellationToken.None));
            Environment.SetEnvironmentVariable("TMDBKey", " ");
            CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
            mode = "full";
            await Assert.ThrowsAsync<InvalidOperationException>(() => upcoming.GetAsync(CancellationToken.None));
            Environment.SetEnvironmentVariable("TMDBKey", "test-key");
            var ids = new HashSet<int>();
            await (Task)typeof(UpcomingCatalogService).GetMethod("CollectDiscoverIdsAsync", BindingFlags.NonPublic | BindingFlags.Static)!
                .Invoke(null, ["/tv/on_the_air", 1, ids, false, CancellationToken.None])!;
            await (Task)typeof(UpcomingCatalogService).GetMethod("TryGetTmdbAsync", BindingFlags.NonPublic | BindingFlags.Static)!
                .Invoke(null, ["/movie/1", CancellationToken.None])!;
        }
        finally
        {
            OutboundHttp.Send = previousSend;
            Environment.SetEnvironmentVariable("TMDBKey", previousKey);
        }
    }

    [Fact]
    public async Task BooksAndGames_CoverSearchImportAndTokenEdges()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        var previousSend = OutboundHttp.Send;
        var previousClient = Environment.GetEnvironmentVariable("IGDB_CLIENT_ID");
        var previousSecret = Environment.GetEnvironmentVariable("IGDB_CLIENT_SECRET");
        var mode = "books";
        OutboundHttp.Send = (request, _) =>
        {
            var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
            if (mode == "down")
            {
                return Task.FromResult(CoverageSupport.Json("""{"error":true}""", HttpStatusCode.BadGateway));
            }

            if (url.Contains("id.twitch.tv", StringComparison.Ordinal))
            {
                var body = mode switch
                {
                    "token-empty" => """{"access_token":null}""",
                    "token-missing" => """{}""",
                    "token-no-expiry" => """{"access_token":"abc"}""",
                    "token-bad-expiry" => """{"access_token":"abc","expires_in":1.5}""",
                    _ => """{"access_token":"abc","expires_in":120}""",
                };
                var status = mode == "token-denied" ? HttpStatusCode.Unauthorized : HttpStatusCode.OK;
                return Task.FromResult(CoverageSupport.Json(body, status));
            }

            if (url.Contains("api.igdb.com", StringComparison.Ordinal))
            {
                var query = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
                if (mode == "games-array")
                {
                    return Task.FromResult(CoverageSupport.Json(query.Contains("where id", StringComparison.Ordinal) ? GameImport(query) : GameSearch()));
                }

                return Task.FromResult(CoverageSupport.Json("""{"error":true}"""));
            }

            if (url.Contains("openlibrary.org", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json(BookBody(url, mode)));
            }

            return Task.FromResult(CoverageSupport.Json("""{}"""));
        };
        try
        {
            var books = new OpenLibraryCatalogService(new ConfigurationBuilder().Build());
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.SearchAsync(null, CancellationToken.None));
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.SearchAsync("a", CancellationToken.None));
            mode = "books-empty";
            Assert.NotNull(await books.SearchAsync("ha\"unt\\", CancellationToken.None));
            mode = "books";
            Assert.NotNull(await books.SearchAsync("haunt", CancellationToken.None));
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.ImportAsync("nope", CancellationToken.None));
            mode = "books-notitle";
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.ImportAsync("OL100W", CancellationToken.None));
            mode = "books-work-only";
            Assert.NotNull(await books.ImportAsync("OL101W", CancellationToken.None));
            mode = "books-full";
            Assert.NotNull(await books.ImportAsync("OL102W", CancellationToken.None));
            Assert.NotNull(await books.ImportAsync("OL102W", CancellationToken.None));
            mode = "books-long";
            Assert.NotNull(await books.ImportAsync("OL103W", CancellationToken.None));
            mode = "down";
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.SearchAsync("haunt", CancellationToken.None));
            var zero = typeof(OpenLibraryCatalogService).GetMethod("SubjectKey", BindingFlags.NonPublic | BindingFlags.Static)!;
            zero.Invoke(null, [string.Empty]);
            zero.Invoke(null, ["horror"]);
            Environment.SetEnvironmentVariable("HorrorVerseDb", " ");
            await Assert.ThrowsAsync<InvalidOperationException>(() => books.ImportAsync("OL104W", CancellationToken.None));
            Environment.SetEnvironmentVariable("HorrorVerseDb", connectionString);

            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
            var games = new IgdbCatalogService(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["IGDB_CLIENT_ID"] = "from-config",
                ["IGDB_CLIENT_SECRET"] = "from-config",
            }).Build());
            Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", null);
            Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", null);
            mode = "games-object";
            await Assert.ThrowsAsync<InvalidOperationException>(() => games.SearchAsync(null, CancellationToken.None));
            mode = "games-array";
            Assert.NotNull(await games.SearchAsync("ha\"unt", CancellationToken.None));
            await Assert.ThrowsAsync<InvalidOperationException>(() => games.ImportAsync("nope", CancellationToken.None));
            Assert.NotNull(await games.ImportAsync("880001", CancellationToken.None));
            Assert.NotNull(await games.ImportAsync("880001", CancellationToken.None));
            Assert.NotNull(await games.ImportAsync("880002", CancellationToken.None));
            mode = "games-object";
            await Assert.ThrowsAsync<InvalidOperationException>(() => games.ImportAsync("880003", CancellationToken.None));
            mode = "down";
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
            await Assert.ThrowsAsync<InvalidOperationException>(() => games.SearchAsync("haunt", CancellationToken.None));
            mode = "token-denied";
            await Assert.ThrowsAsync<InvalidOperationException>(() => games.SearchAsync("haunt", CancellationToken.None));
            mode = "token-missing";
            await Assert.ThrowsAsync<InvalidOperationException>(() => games.SearchAsync("haunt", CancellationToken.None));
            mode = "token-empty";
            Assert.NotNull(await games.SearchAsync("haunt", CancellationToken.None));
            mode = "token-no-expiry";
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
            Assert.NotNull(await games.SearchAsync("haunt", CancellationToken.None));
            mode = "token-bad-expiry";
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
            Assert.NotNull(await games.SearchAsync("haunt", CancellationToken.None));
            CoverageSupport.SetIgdbToken("cached", DateTimeOffset.UtcNow.AddHours(2));
            mode = "games-array";
            Assert.NotNull(await games.SearchAsync("haunt", CancellationToken.None));
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
            Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", null);
            var noSecret = new IgdbCatalogService(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["IGDB_CLIENT_ID"] = "client" }).Build());
            await Assert.ThrowsAsync<InvalidOperationException>(() => noSecret.SearchAsync("haunt", CancellationToken.None));
            Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", "secret");
            Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", null);
            var noClient = new IgdbCatalogService(new ConfigurationBuilder().Build());
            await Assert.ThrowsAsync<InvalidOperationException>(() => noClient.SearchAsync("haunt", CancellationToken.None));
            Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", "client");
            var fromEnv = new IgdbCatalogService(new ConfigurationBuilder().Build());
            mode = "games-array";
            Assert.NotNull(await fromEnv.SearchAsync("haunt", CancellationToken.None));
            typeof(IgdbCatalogService).GetMethod("SubjectKey", BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, [string.Empty]);
            Environment.SetEnvironmentVariable("HorrorVerseDb", null);
            await Assert.ThrowsAsync<InvalidOperationException>(() => fromEnv.ImportAsync("880004", CancellationToken.None));
        }
        finally
        {
            OutboundHttp.Send = previousSend;
            Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", previousClient);
            Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", previousSecret);
            Environment.SetEnvironmentVariable("HorrorVerseDb", connectionString);
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
        }
    }

    private static SearchContainer<SearchMovie> Movies() => new()
    {
        Results =
        [
            new SearchMovie { Id = 1, Title = "Halloween", GenreIds = [27], ReleaseDate = new DateTime(1978, 10, 25), Overview = new string('o', 200) },
            new SearchMovie { Id = 2, Title = "Doc", GenreIds = [99], Overview = "" },
            new SearchMovie { Id = 3, Title = "Comedy", GenreIds = [35], ReleaseDate = new DateTime(1800, 1, 1) },
            new SearchMovie { Id = 4, Title = "Bare", GenreIds = null, Overview = null },
        ],
    };

    private static SearchContainer<SearchTv> Shows() => new()
    {
        Results =
        [
            new SearchTv { Id = 8, Name = "Haunt", GenreIds = [27], FirstAirDate = new DateTime(2018, 1, 1), Overview = "short" },
            new SearchTv { Id = 9, Name = "Doc Show", GenreIds = [99] },
            new SearchTv { Id = 10, Name = "Comedy", GenreIds = [35] },
            new SearchTv { Id = 11, Name = "Bare", GenreIds = null },
        ],
    };

    private static string UpcomingBody(string url)
    {
        var soon = DateTime.UtcNow.Date.AddDays(20).ToString("yyyy-MM-dd");
        var past = DateTime.UtcNow.Date.AddDays(-4).ToString("yyyy-MM-dd");
        var far = DateTime.UtcNow.Date.AddYears(3).ToString("yyyy-MM-dd");
        var page = url.Contains("page=2", StringComparison.Ordinal) || url.Contains("page=3", StringComparison.Ordinal);
        if (page)
        {
            return """{"total_pages":1.5,"results":[]}""";
        }

        if (url.Contains("/discover/movie", StringComparison.Ordinal))
        {
            var overview = new string('a', 450);
            return "{\"total_pages\":2,\"results\":["
                + "{\"id\":0,\"title\":\"Zero\",\"release_date\":\"" + soon + "\"},"
                + "{\"id\":901,\"title\":\"\",\"release_date\":\"" + soon + "\"},"
                + "{\"id\":902,\"title\":\"NoDate\"},"
                + "{\"id\":903,\"title\":\"Past\",\"release_date\":\"" + past + "\",\"overview\":\" \"},"
                + "{\"id\":904,\"title\":\"Far\",\"release_date\":\"" + far + "\"},"
                + "{\"id\":905,\"title\":\"Bad\",\"release_date\":\"nope\"},"
                + "{\"id\":906,\"title\":\"Soon\",\"release_date\":\"" + soon + "\",\"overview\":\"" + overview + "\",\"poster_path\":\"/soon.jpg\"},"
                + "{\"id\":907,\"title\":\"Plain\",\"release_date\":\"" + soon + "\",\"overview\":\"short\",\"poster_path\":\"plain\"},"
                + "{\"id\":908,\"title\":\"Dots\",\"release_date\":\"" + soon + "\",\"poster_path\":\"/../x\"},"
                + "{\"id\":1.5,\"title\":\"Nope\",\"release_date\":\"" + soon + "\"}]}";
        }

        if (url.Contains("first_air_date", StringComparison.Ordinal))
        {
            return "{\"total_pages\":2,\"results\":["
                + "{\"id\":1,\"name\":\"Horror Falls\",\"overview\":\"a ghost story\",\"first_air_date\":\"" + soon + "\",\"poster_path\":\"/p.jpg\"},"
                + "{\"id\":1,\"name\":\"Horror Falls\",\"first_air_date\":\"" + soon + "\"},"
                + "{\"id\":2,\"name\":\"Sitcom\",\"overview\":\"horror\",\"genre_ids\":[35],\"first_air_date\":\"" + soon + "\"},"
                + "{\"id\":3,\"name\":\"Cooking\",\"overview\":\"food\",\"first_air_date\":\"" + soon + "\"},"
                + "{\"id\":4,\"name\":\"Old Horror\",\"overview\":\"vampire\",\"first_air_date\":\"" + past + "\"},"
                + "{\"id\":5,\"name\":\" \",\"overview\":\"horror\",\"first_air_date\":\"" + soon + "\"},"
                + "{\"id\":6,\"name\":\"Far Horror\",\"overview\":\"zombie\",\"first_air_date\":\"" + far + "\"}]}";
        }

        if (url.Contains("airing_today", StringComparison.Ordinal))
        {
            return """{"results":"nope"}""";
        }

        if (url.Contains("on_the_air", StringComparison.Ordinal))
        {
            return """{"total_pages":1,"results":[{"id":0},{"id":1.5,"name":"Horror bad","overview":"ghost"},{"name":"Horror nameless","overview":"slasher"}]}""";
        }

        if (url.Contains("/discover/tv", StringComparison.Ordinal))
        {
            return "{\"total_pages\":2,\"results\":["
                + "{\"id\":501,\"name\":\"Horror Hour\",\"overview\":\"ghost\"},"
                + "{\"id\":502,\"name\":\"Horror Keys\",\"overview\":\"haunt\"},"
                + "{\"id\":503,\"name\":\"Horror Named\",\"overview\":\"vampire\"},"
                + "{\"id\":504,\"name\":\"Horror Later\",\"overview\":\"zombie\"},"
                + "{\"id\":505,\"name\":\"Horror Excluded\",\"overview\":\"ghost\",\"genre_ids\":[35]},"
                + "{\"id\":506,\"name\":\"   \",\"overview\":\"horror\"},"
                + "{\"id\":507,\"name\":\"Horror Bare\",\"overview\":\"demon\"},"
                + "{\"id\":508,\"name\":\"Horror Date\",\"overview\":\"occult\"},"
                + "{\"id\":510,\"name\":\"No Next\",\"overview\":\"zombie\"}]}";
        }

        if (url.Contains("/tv/", StringComparison.Ordinal))
        {
            var id = 0;
            var marker = "/tv/";
            var start = url.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
            var rest = url[start..];
            var end = rest.IndexOfAny(['?', '/']);
            _ = int.TryParse(end < 0 ? rest : rest[..end], out id);
            if (id == 509)
            {
                return """{"name":"Missing"}""";
            }

            var longOverview = new string('b', 420);
            return id switch
            {
                501 => "{\"name\":\"Horror Hour\",\"overview\":\"ghost story\",\"genres\":[{\"id\":27}],\"keywords\":{\"results\":[{\"id\":3158,\"name\":\"x\"},{\"id\":1,\"name\":\"Haunted\"},{\"id\":1.5,\"name\":\"Other\"},{\"name\":1}]},\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"The Wake\",\"season_number\":1,\"episode_number\":2,\"overview\":\"" + longOverview + "\"},\"poster_path\":\"/ep.jpg\"}",
                502 => "{\"name\":\"Horror Keys\",\"keywords\":{\"keywords\":[{\"name\":\"ghost\"}]},\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"season_number\":2,\"episode_number\":3},\"poster_path\":\"bad\"}",
                503 => "{\"name\":\"Horror Named\",\"overview\":\"vampire\",\"keywords\":{\"other\":[]},\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"Cold Open\",\"season_number\":0,\"episode_number\":0},\"poster_path\":\"/../x\"}",
                504 => "{\"name\":\"Horror Later\",\"overview\":\"zombie\",\"keywords\":[],\"next_episode_to_air\":{\"air_date\":\"" + far + "\",\"name\":\"Later\",\"season_number\":1,\"episode_number\":1}}",
                505 => "{\"name\":\"Excluded\",\"overview\":\"horror\",\"genres\":[{\"id\":35},{\"id\":1.5},{\"nope\":1}],\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"A\",\"season_number\":1,\"episode_number\":1}}",
                506 => "{\"name\":\"   \",\"overview\":\"horror\",\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"Only Name\"}}",
                507 => "{\"name\":\"Horror Bare\",\"overview\":\"demon\",\"keywords\":\"nope\",\"next_episode_to_air\":{\"air_date\":\"nope\",\"name\":\"Bad Date\",\"season_number\":1,\"episode_number\":1}}",
                508 => "{\"name\":\"Horror Date\",\"overview\":\"occult\",\"next_episode_to_air\":\"soon\",\"poster_path\":\"/\"}",
                _ => "{\"name\":\"No Next\",\"overview\":\"zombie\",\"keywords\":[]}",
            };
        }

        return """{"results":[]}""";
    }

    private static string BookBody(string url, string mode)
    {
        if (mode == "books-empty")
        {
            return """{"docs":"nope"}""";
        }

        if (url.Contains("search.json", StringComparison.Ordinal) && url.Contains("key", StringComparison.Ordinal))
        {
            if (mode is "books-notitle" or "books-work-only")
            {
                return """{"docs":[]}""";
            }

            if (mode == "books-long")
            {
                return "{\"docs\":[{\"title\":\"" + new string('T', 180) + "\",\"author_name\":[\"" + new string('A', 70) + "\",\"" + new string('B', 70) + "\",\"" + new string('C', 70) + "\",\"" + new string('D', 70) + "\"],\"first_publish_year\":4000,\"cover_i\":0,\"number_of_pages_median\":0,\"isbn\":[\"12\",\"abc\"],\"publisher\":[\"   \"],\"subject\":[\"Cooking\"]}]}";
            }

            return """{"docs":[{"title":"The Haunt: A Story","subtitle":"A Story","author_name":["Shirley Jackson",1,"  "],"first_publish_year":1959,"cover_i":12,"number_of_pages_median":200,"isbn":["978-0-123456789","012345678X"],"publisher":["Viking","Extra"],"subject":["Horror","Ghost"]}]}""";
        }

        if (url.Contains("search.json", StringComparison.Ordinal))
        {
            if (mode == "books-empty")
            {
                return """{"docs":"nope"}""";
            }

            return """
                {"docs":[
                  {"title":"Skip"},
                  {"key":"OL1W","title":"The Haunt","author_name":["Shirley Jackson","Ann","Bob","Cara","Dan"],"first_publish_year":1959,"cover_i":12,"subject":["Horror","Ghost","Haunt","Extra"]},
                  {"key":"/works/OL2W","title":"Plain","subject":["Cooking"],"author_name":[],"cover_i":0,"first_publish_year":0},
                  {"key":"not-a-work","title":"Bad"},
                  {"key":"OL3W"},
                  {"key":"OL4W","title":"   ","subject":["horror"]}
                ]}
                """;
        }

        if (url.Contains("/works/", StringComparison.Ordinal))
        {
            return mode switch
            {
                "books-notitle" => """{"description":"   ","subjects":"nope","covers":"nope"}""",
                "books-work-only" => """{"title":"Work Only","description":{"other":1},"subjects":["Horror","Horror"],"covers":[0,44,1.5],"subtitle":"   "}""",
                "books-long" => "{\"title\":\"" + new string('T', 180) + "\",\"subtitle\":\"" + new string('S', 40) + "\",\"description\":\"" + new string('D', 4100) + "\",\"subjects\":[\"" + new string('H', 90) + "\",\"Horror\"],\"covers\":[-1]}",
                _ => """{"title":"The Haunt","subtitle":"A Story","description":{"value":"A quiet house"},"subjects":["Horror","Ghost",""],"covers":[12]}""",
            };
        }

        if (url.Contains("key:/works/", StringComparison.Ordinal))
        {
            if (mode is "books-notitle" or "books-work-only")
            {
                return """{"docs":[]}""";
            }

            if (mode == "books-long")
            {
                return "{\"docs\":[{\"title\":\"" + new string('T', 180) + "\",\"author_name\":[\"" + new string('A', 70) + "\",\"" + new string('B', 70) + "\",\"" + new string('C', 70) + "\",\"" + new string('D', 70) + "\"],\"first_publish_year\":4000,\"cover_i\":0,\"number_of_pages_median\":0,\"isbn\":[\"12\",\"abc\"],\"publisher\":[\"   \"],\"subject\":[\"Cooking\"]}]}";
            }

            return """{"docs":[{"title":"The Haunt: A Story","subtitle":"A Story","author_name":["Shirley Jackson",1,"  "],"first_publish_year":1959,"cover_i":12,"number_of_pages_median":200,"isbn":["978-0-123456789","012345678X"],"publisher":["Viking","Extra"],"subject":["Horror","Ghost"]}]}""";
        }

        return """
            {"docs":[
              {"title":"Skip"},
              {"key":"OL1W","title":"The Haunt","author_name":["Shirley Jackson","Ann","Bob","Cara","Dan"],"first_publish_year":1959,"cover_i":12,"subject":["Horror","Ghost","Haunt","Extra"]},
              {"key":"/works/OL2W","title":"Plain","subject":["Cooking"],"author_name":[],"cover_i":0,"first_publish_year":0},
              {"key":"not-a-work","title":"Bad"},
              {"key":"OL3W"},
              {"key":"OL4W","title":"   ","subject":["horror"]}
            ]}
            """;
    }

    private static string GameSearch()
    {
        var far = new DateTimeOffset(4000, 1, 1, 0, 0, 0, TimeSpan.Zero).ToUnixTimeSeconds();
        return "["
            + "{\"name\":\"Skip\"},"
            + "{\"id\":0,\"name\":\"Zero\"},"
            + "{\"id\":7,\"name\":\"Haunt\",\"genres\":[{\"name\":\"Horror\"},{\"name\":\"Adventure\"},{\"name\":1}],\"themes\":[{\"name\":\"Survival Horror\"}],\"platforms\":[{\"name\":\"PC\"},{\"name\":\"PS5\"},{\"name\":\"Switch\"},{\"name\":\"Extra\"}],\"summary\":\"x\",\"first_release_date\":1600000000,\"cover\":{\"image_id\":\"abc\"}},"
            + "{\"id\":8,\"name\":\"Puzzle\",\"genres\":[{\"name\":\"Puzzle\"}],\"summary\":\"y\",\"cover\":{\"image_id\":\"bad id\"},\"first_release_date\":" + far + "},"
            + "{\"id\":9,\"name\":\"   \"},"
            + "{\"id\":10,\"name\":\"No bits\",\"genres\":\"nope\",\"first_release_date\":0},"
            + "{\"id\":1.5,\"name\":\"Bad\"}"
            + "]";
    }

    private static string GameImport(string query)
    {
        if (query.Contains("880002", StringComparison.Ordinal))
        {
            return """[{"id":880002,"name":"Bare Game"}]""";
        }

        if (query.Contains("880003", StringComparison.Ordinal))
        {
            return "[]";
        }

        var companies = string.Join(',', Enumerable.Range(1, 4).Select(i => "{\"developer\":true,\"publisher\":true,\"company\":{\"name\":\"Studio " + i + "\"}}"));
        return "[{"
            + "\"id\":880001,\"name\":\" " + new string('G', 210) + " \",\"summary\":\"A long summary\",\"first_release_date\":1,\"cover\":{\"image_id\":\"cover_1\"},"
            + "\"genres\":[{\"name\":\"Horror\"},{\"name\":\"Horror\"}],\"themes\":[{\"name\":\" \"},{\"name\":\"Ghost\"}],\"platforms\":[{\"name\":\"PC\"}],"
            + "\"involved_companies\":[" + companies + ",{\"developer\":false,\"publisher\":false,\"company\":{\"name\":\"Other\"}},{\"developer\":true},{\"developer\":\"yes\",\"publisher\":\"no\",\"company\":{\"name\":\"Weird\"}}]}"
            + "]";
    }
}
