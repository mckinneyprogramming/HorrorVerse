using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Library;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Tests.Api;

public class GapCoverageTests
{
    [Fact]
    public async Task Host_ServesIndexAndRemovesFranchiseByEitherListId()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        var root = Directory.CreateTempSubdirectory("horrorverse-spa").FullName;
        await File.WriteAllTextAsync(Path.Combine(root, "index.html"), "<!doctype html><title>HorrorVerse</title>");
        var previousAdmin = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
        var adminEmail = $"gap-admin-{Guid.NewGuid():N}@example.com";
        var memberEmail = $"gap-member-{Guid.NewGuid():N}@example.com";
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", adminEmail);
        try
        {
            await using var factory = new SpaApplication(root);
            using var client = factory.CreateClient();
            var home = await client.GetAsync("/");
            Assert.Equal(HttpStatusCode.OK, home.StatusCode);
            Assert.Contains("HorrorVerse", await home.Content.ReadAsStringAsync(), StringComparison.Ordinal);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health")).StatusCode);

            using var admin = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
            using var member = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/auth", new { action = "register", email = adminEmail, password = "vault-key", displayName = "Gap" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth", new { action = "register", email = memberEmail, password = "vault-key", displayName = "Member" })).StatusCode);
            var franchiseName = "Gap Spa " + Guid.NewGuid().ToString("N")[..8];
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/franchises", new { name = franchiseName })).StatusCode);
            var franchises = await admin.GetFromJsonAsync<JsonElement>("/api/franchises");
            var franchiseId = franchises.GetProperty("franchises").EnumerateArray().Last().GetProperty("id").GetInt32();
            var listName = "Gap Spa List " + Guid.NewGuid().ToString("N")[..8];
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { name = listName })).StatusCode);
            var lists = await member.GetFromJsonAsync<JsonElement>("/api/lists");
            var listId = lists.GetProperty("lists").EnumerateArray().Last().GetProperty("id").GetInt32();
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/lists?id={listId}&franchiseId={franchiseId}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/lists?listId={listId}&franchiseId={franchiseId}")).StatusCode);
            await CoverageSupport.Exec(connectionString, $"DELETE FROM franchise WHERE id = {franchiseId}");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", previousAdmin);
            if (Directory.Exists(root))
            {
                Directory.Delete(root, true);
            }
        }
    }

    [Fact]
    public async Task Catalog_CoversNullsExceptionsAndWriteEdges()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        await using var factory = new WebApplicationFactory<Program>();
        await using var scope = factory.Services.CreateAsyncScope();
        var catalog = scope.ServiceProvider.GetRequiredService<CatalogService>();
        var keywords = scope.ServiceProvider.GetRequiredService<KeywordCatalogService>();
        var stamp = Guid.NewGuid().ToString("N")[..8];
        await SeedCatalogRows(connectionString, stamp);
        Assert.NotNull(catalog.GetAll());

        await Gap.WithIntegerColumn(connectionString, "media_keyword", "name", () => Task.FromResult(catalog.GetAll()));
        await Gap.WithIntegerColumn(connectionString, "movie", "posterpath", () => Task.FromResult(catalog.GetAll()));
        await Gap.WithIntegerColumn(connectionString, "show", "posterpath", () => Task.FromResult(catalog.GetAll()));
        await Gap.WithIntegerColumn(connectionString, "book", "author", () => Task.FromResult(catalog.GetAll()));
        await Gap.WithIntegerColumn(connectionString, "game", "developer", () => Task.FromResult(catalog.GetAll()));

        var bare = new CatalogService(null!, null!, null!, keywords, new ConfigurationBuilder().Build(), NullLogger<CatalogService>.Instance);
        Gap.CallRead(bare);
        var previous = Environment.GetEnvironmentVariable("HorrorVerseDb");
        Environment.SetEnvironmentVariable("HorrorVerseDb", null);
        try
        {
            Assert.Null(CatalogService.ResolveConnectionString(new ConfigurationBuilder().Build()));
            Assert.Null(CatalogService.ResolveConnectionString(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:HorrorVerse"] = " " }).Build()));
            Assert.Equal("Host=db", CatalogService.ResolveConnectionString(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:HorrorVerse"] = "Host=db" }).Build()));
            Assert.Empty((System.Collections.IEnumerable)Gap.Call(bare, "ReadShows")!);
            Assert.Empty((System.Collections.IEnumerable)Gap.Call(bare, "ReadOptionalTable", "SELECT 1", "podcast")!);
            Assert.Throws<TargetInvocationException>(() => typeof(CatalogService).GetMethod("OpenConnection", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(bare, null));
        }
        finally
        {
            Environment.SetEnvironmentVariable("HorrorVerseDb", previous);
        }

        Assert.Empty((System.Collections.IEnumerable)Gap.Call(catalog, "ReadOptionalTable", "SELECT * FROM gap_missing_catalog", "podcast")!);
        Assert.Throws<InvalidOperationException>(() => Gap.Call(catalog, "FindExistingId", "nope", "Title", 1990, null));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(catalog, "CurrentYear", "nope", 1));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "InsertSql", "nope"));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "UpdateSql", "nope"));
        Assert.Throws<InvalidOperationException>(() => Gap.Call(typeof(CatalogService), "DeleteSql", "nope"));
        await Gap.WithRenamedColumn(connectionString, "movie", "title", "title_gap", () =>
        {
            Assert.Null(Gap.Call(catalog, "FindExistingId", "movie", "Missing", 1990, null));
            return Task.CompletedTask;
        });
        await Gap.WithRenamedColumn(connectionString, "movie", "releaseyear", "releaseyear_gap", () =>
        {
            Assert.Equal(0, Gap.Call(catalog, "CurrentYear", "movie", 1));
            return Task.CompletedTask;
        });

        var movieId = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM movie ORDER BY id LIMIT 1");
        await CoverageSupport.Exec(connectionString, "ALTER TABLE movie ALTER COLUMN releaseyear DROP NOT NULL");
        await CoverageSupport.Exec(connectionString, $"UPDATE movie SET releaseyear = NULL WHERE id = {movieId}");
        Assert.Equal(0, Gap.Call(catalog, "CurrentYear", "movie", movieId));
        Assert.Equal(0, Gap.Call(catalog, "CurrentYear", "movie", 99999999));
        await CoverageSupport.Exec(connectionString, $"UPDATE movie SET releaseyear = 1978 WHERE id = {movieId}");

        foreach (var (kind, title, year, time) in new (string, string, int?, decimal?)[]
        {
            ("movie", $"Gap Movie {stamp}", null, -1m),
            ("series", $"Gap Series {stamp}", 0, null),
            ("documentary", $"Gap Doc {stamp}", 3001, 12m),
            ("show", $"Gap Show {stamp}", 1991, 0m),
            ("book", $"Gap Book {stamp}", 2001, null),
            ("podcast", $"Gap Pod {stamp}", 2010, null),
            ("game", $"Gap Game {stamp}", 2012, null),
        })
        {
            catalog.Create(new CatalogWriteRequest { Kind = kind, Title = title, ReleaseYear = year, TotalTime = time, Pages = kind == "book" ? -3 : 4, TotalEpisodes = -1, NumberOfSeasons = null, TotalMovies = -2 });
        }

        Assert.Throws<InvalidOperationException>(() => catalog.Create(new CatalogWriteRequest { Kind = "movie", Title = $"Gap Movie {stamp}", ReleaseYear = DateTime.UtcNow.Year }));
        Assert.Throws<InvalidOperationException>(() => catalog.Create(new CatalogWriteRequest { Kind = "movie", Title = " " }));
        Assert.Throws<InvalidOperationException>(() => catalog.Create(new CatalogWriteRequest { Kind = "movie", Title = new string('T', 201) }));
        Assert.Throws<InvalidOperationException>(() => catalog.Create(new CatalogWriteRequest { Kind = "comic", Title = "Nope" }));
        Assert.Throws<InvalidOperationException>(() => catalog.Update(new CatalogWriteRequest { Id = "movie:99999999", Title = $"Missing {stamp}" }));
        Assert.Throws<InvalidOperationException>(() => catalog.Delete("movie:99999999"));
        Assert.Throws<InvalidOperationException>(() => catalog.Delete("movie:0"));
        Assert.Throws<InvalidOperationException>(() => catalog.Delete("nope"));
        catalog.Update(new CatalogWriteRequest { Id = $"podcast:1", Title = $"Gap Pod {stamp} renamed" });
        var podcastId = await CoverageSupport.Scalar<int>(connectionString, $"SELECT id FROM podcast WHERE title LIKE 'Gap Pod {stamp}%' ORDER BY id DESC LIMIT 1");
        catalog.Delete($"podcast:{podcastId}");
        Assert.Contains("upload", Gap.Call(typeof(CatalogService), "NormalizeIgdbCover", "https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg") as string);
        Assert.Contains("upload", Gap.Call(typeof(CatalogService), "NormalizeIgdbCover", "https://images.igdb.com/igdb/image/t_cover_big/abc.jpg") as string);
        Assert.Null(Gap.Call(typeof(CatalogService), "NormalizeIgdbCover", " "));
        Assert.Null(Gap.Call(typeof(CatalogService), "NormalizeIgdbCover", "https://example.test/x.jpg"));
    }

    [Fact]
    public async Task FranchiseWatchAndKeywords_CoverRemainingBranches()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        var previousKey = Environment.GetEnvironmentVariable("TMDBKey");
        var previousSend = OutboundHttp.Send;
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        await using var factory = new WebApplicationFactory<Program>();
        await using var scope = factory.Services.CreateAsyncScope();
        var franchises = scope.ServiceProvider.GetRequiredService<FranchiseCatalogService>();
        var watch = scope.ServiceProvider.GetRequiredService<WatchCatalogService>();
        var keywords = scope.ServiceProvider.GetRequiredService<KeywordCatalogService>();
        var stamp = Guid.NewGuid().ToString("N")[..8];
        try
        {
            await CoverageSupport.Exec(connectionString, "DELETE FROM franchise WHERE name LIKE 'Gap Franchise %'");
            var count = await CoverageSupport.Scalar<long>(connectionString, "SELECT COUNT(*) FROM franchise");
            for (var i = count; i < 80; i++)
            {
                franchises.Create(new FranchiseWriteRequest { Name = $"Gap Franchise {stamp} {i}" });
            }

            Assert.Throws<InvalidOperationException>(() => franchises.Create(new FranchiseWriteRequest { Name = $"Gap Franchise overflow {stamp}" }));
            var first = franchises.GetAll().First(item => item.Name.StartsWith("Gap Franchise", StringComparison.Ordinal));
            Assert.Throws<InvalidOperationException>(() => franchises.Rename(new FranchiseWriteRequest { Id = first.Id, Name = franchises.GetAll().Last().Name }));
            franchises.Rename(new FranchiseWriteRequest { FranchiseId = first.Id, Name = $"Gap Franchise renamed {stamp}" });
            franchises.Rename(new FranchiseWriteRequest { Id = first.Id, Name = $"Gap Franchise renamed again {stamp}" });
            Assert.Throws<InvalidOperationException>(() => franchises.Rename(new FranchiseWriteRequest { Id = 99999999, Name = "Missing" }));
            Assert.Throws<InvalidOperationException>(() => franchises.Create(new FranchiseWriteRequest { Name = " " }));
            Assert.Throws<InvalidOperationException>(() => franchises.Create(new FranchiseWriteRequest { Name = new string('F', 81) }));
            Assert.Throws<InvalidOperationException>(() => franchises.AddItem(new FranchiseWriteRequest { Id = 99999999, ItemId = "movie:1" }));

            var seriesId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Series {stamp}', 10, 1, FALSE) RETURNING id");
            var movieId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid) VALUES ('Gap Linked {stamp}', 90, FALSE, 1988, TRUE, {seriesId}) RETURNING id");
            franchises.AddItem(new FranchiseWriteRequest { Id = first.Id, ItemId = $"series:{seriesId}" });
            franchises.AddItem(new FranchiseWriteRequest { FranchiseId = first.Id, ItemId = $"movie:{movieId}" });
            await Gap.WithRenamedTable(connectionString, "movie", "movie_gap", () =>
            {
                Gap.Call(franchises, "AddSeriesMovies", first.Id, seriesId);
                Gap.Call(franchises, "RemoveSeriesMovies", first.Id, seriesId);
                franchises.AddMovieToFranchisesContainingSeries(seriesId, movieId);
                return Task.CompletedTask;
            });
            franchises.RemoveItem(first.Id, $"series:{seriesId}");
            await Gap.WithRenamedTable(connectionString, "franchise_item", "franchise_item_gap", () =>
            {
                franchises.PurgeMedia($"movie:{movieId}");
                return Task.CompletedTask;
            });
            franchises.PurgeMedia("nope");
            await CoverageSupport.Exec(connectionString, "DELETE FROM franchise WHERE name LIKE 'Gap Franchise %'");

            CoverageSupport.ClearStaticCache(typeof(WatchCatalogService));
            Assert.Null(Gap.Call(watch, "ReadTarget", "book", 1));
            var responses = new Queue<HttpResponseMessage>();
            OutboundHttp.Send = (_, _) => Task.FromResult(responses.Dequeue());
            var bareMovie = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries) VALUES ('Gap Watch {stamp}', 90, FALSE, 1978, FALSE) RETURNING id");
            responses.Enqueue(new HttpResponseMessage(HttpStatusCode.BadGateway));
            await Assert.ThrowsAsync<InvalidOperationException>(() => watch.GetAsync($"movie:{bareMovie}", CancellationToken.None));
            responses.Enqueue(CoverageSupport.Json("""{"results":"nope"}"""));
            await Assert.ThrowsAsync<InvalidOperationException>(() => watch.GetAsync($"movie:{bareMovie}", CancellationToken.None));
            responses.Enqueue(CoverageSupport.Json("""{"other":1}"""));
            await Assert.ThrowsAsync<InvalidOperationException>(() => watch.GetAsync($"movie:{bareMovie}", CancellationToken.None));
            responses.Enqueue(CoverageSupport.Json("{\"results\":[{\"title\":\"Gap Watch " + stamp + "\",\"release_date\":\"   \"},{\"id\":0,\"title\":\"Gap Watch " + stamp + "\",\"release_date\":\"0999-01-01\"},{\"id\":1.5,\"title\":\"Gap Watch " + stamp + "\",\"release_date\":\"1978-10-25\"},{\"id\":4,\"title\":\"Gap Watch " + stamp + "\",\"release_date\":\"1978-10-25\"},{\"id\":5,\"title\":\"Other\",\"release_date\":\"1978-01-01\"}]}"));
            responses.Enqueue(CoverageSupport.Json("""{"results":{"US":{"link":"  ","flatrate":[{"provider_id":8,"provider_name":"Stream","logo_path":"/s.jpg","display_priority":2},{"provider_id":8,"provider_name":"Dup","logo_path":"  "},{"provider_id":0,"provider_name":"Zero"},{"provider_name":"Missing"},{"provider_id":9,"provider_name":"Rentless","display_priority":1.5}],"rent":"nope","buy":[],"ads":[{"provider_id":10,"provider_name":"Ads","logo_path":"https://cdn/a.jpg"}]}}}"""));
            var offer = await watch.GetAsync($"movie:{bareMovie}", CancellationToken.None);
            Assert.Equal("Gap Watch " + stamp, offer.Title);
            Assert.Equal(offer, await watch.GetAsync($"movie:{bareMovie}", CancellationToken.None));
            CoverageSupport.ExpireCache(typeof(WatchCatalogService), $"movie:{bareMovie}:US");
            responses.Enqueue(CoverageSupport.Json("""{"results":{"US":[]}}"""));
            Assert.NotNull(await watch.GetAsync($"movie:{bareMovie}", CancellationToken.None));

            await CoverageSupport.Exec(connectionString, "ALTER TABLE movie ALTER COLUMN releaseyear DROP NOT NULL; ALTER TABLE show ALTER COLUMN releaseyear DROP NOT NULL; ALTER TABLE documentary ALTER COLUMN releaseyear DROP NOT NULL;");
            var shortMovie = await CoverageSupport.Scalar<int>(connectionString, "INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries) VALUES ('Q', 1, FALSE, NULL, FALSE) RETURNING id");
            Assert.Throws<InvalidOperationException>(() => watch.GetAsync($"movie:{shortMovie}", CancellationToken.None).GetAwaiter().GetResult());
            var showId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ('Gap Watch Show {stamp}', 0, 0, 0, FALSE, NULL) RETURNING id");
            responses.Enqueue(CoverageSupport.Json("{\"results\":[{\"id\":6,\"name\":\"Gap Watch Show " + stamp + "\",\"first_air_date\":\"not-a-date\"}]}"));
            responses.Enqueue(CoverageSupport.Json("""{"results":{}}"""));
            Assert.NotNull(await watch.GetAsync($"show:{showId}", CancellationToken.None));
            Assert.Throws<InvalidOperationException>(() => watch.GetAsync("series:1", CancellationToken.None).GetAwaiter().GetResult());
            Assert.Throws<InvalidOperationException>(() => watch.GetAsync("book:1", CancellationToken.None).GetAwaiter().GetResult());
            Assert.Throws<InvalidOperationException>(() => watch.GetAsync("comic:1", CancellationToken.None).GetAwaiter().GetResult());
            Assert.Throws<InvalidOperationException>(() => watch.GetAsync("movie:0", CancellationToken.None).GetAwaiter().GetResult());
            Environment.SetEnvironmentVariable("TMDBKey", " ");
            var keyed = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO documentary (title, totaltime, watched, releaseyear, tmdbid) VALUES ('Gap Doc Watch {stamp}', 1, FALSE, 2001, 4) RETURNING id");
            Assert.Throws<InvalidOperationException>(() => watch.GetAsync($"documentary:{keyed}", CancellationToken.None).GetAwaiter().GetResult());
            Environment.SetEnvironmentVariable("TMDBKey", null);
            Environment.SetEnvironmentVariable("HorrorVerseDb", " ");
            Assert.Throws<TargetInvocationException>(() => typeof(WatchCatalogService).GetMethod("OpenConnection", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(watch, null));
            Environment.SetEnvironmentVariable("HorrorVerseDb", connectionString);
            Environment.SetEnvironmentVariable("TMDBKey", "test-key");

            keywords.EnsureSchema();
            await CoverageSupport.Exec(connectionString, $"INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name) VALUES ('movie', {movieId}, 910001, '   '), ('movie', {movieId}, 910002, 'Ghost'), ('movie', {movieId}, 910003, 'ghost'), ('series', {seriesId}, 910002, 'Ghost') ON CONFLICT DO NOTHING");
            Assert.NotNull(keywords.LoadAll());
            await CoverageSupport.Exec(connectionString, """
                CREATE OR REPLACE FUNCTION gap_keyword_boom() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                  RAISE EXCEPTION 'gap keyword';
                END $$;
                DROP TRIGGER IF EXISTS gap_keyword_boom ON media_keyword;
                CREATE TRIGGER gap_keyword_boom BEFORE DELETE ON media_keyword
                FOR EACH ROW EXECUTE FUNCTION gap_keyword_boom();
                """);
            try
            {
                keywords.DeleteFor("movie", movieId);
                keywords.ReplaceSeriesFromMovies(seriesId);
            }
            finally
            {
                await CoverageSupport.Exec(connectionString, "DROP TRIGGER IF EXISTS gap_keyword_boom ON media_keyword");
            }

            await Gap.WithRenamedColumn(connectionString, "movie", "title", "title_gap", () =>
            {
                Assert.Empty(keywords.ListMovies());
                return Task.CompletedTask;
            });
            keywords.SaveTmdbId("series", seriesId, 77);
            keywords.SaveTmdbId("nope", 1, 1);
            OutboundHttp.Send = (_, _) => Task.FromResult(CoverageSupport.Json("""{"keywords":[{"id":3,"name":"slash"},{"id":0,"name":"nope"},{"name":"ghost"},{"id":4,"name":" "},{"id":5,"name":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}]}"""));
            await keywords.SaveMovieAsync(movieId, 30);
            await keywords.SaveMovieAsync(movieId, 30, skipIfPresent: true);
            await keywords.SaveDocumentaryAsync(keyed, 40);
            await keywords.SaveDocumentaryAsync(keyed, 40, skipIfPresent: true);
            await keywords.SaveShowAsync(showId, 80);
            await keywords.SaveShowAsync(showId, 80, skipIfPresent: true);
            OutboundHttp.Send = (_, _) => Task.FromResult(CoverageSupport.Json("""{"results":[{"id":6,"name":"haunt"}]}"""));
            await keywords.SaveShowAsync(showId, 80, skipIfPresent: false);
            OutboundHttp.Send = (_, _) => Task.FromResult(CoverageSupport.Json("""{}"""));
            await keywords.SaveMovieAsync(movieId, 30, skipIfPresent: false);
            OutboundHttp.Send = (_, _) => Task.FromResult(CoverageSupport.Json("""{"keywords":{"nope":true}}"""));
            await keywords.SaveMovieAsync(movieId, 30, skipIfPresent: false);
            OutboundHttp.Send = (_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
            await keywords.SaveMovieAsync(movieId, 30, skipIfPresent: false);
            Environment.SetEnvironmentVariable("TMDBKey", null);
            await keywords.SaveMovieAsync(movieId, 0);
            Environment.SetEnvironmentVariable("HorrorVerseDb", null);
            Assert.Throws<TargetInvocationException>(() => typeof(KeywordCatalogService).GetMethod("OpenConnection", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(keywords, null));
        }
        finally
        {
            OutboundHttp.Send = previousSend;
            Environment.SetEnvironmentVariable("TMDBKey", previousKey);
            Environment.SetEnvironmentVariable("HorrorVerseDb", connectionString);
            await CoverageSupport.Exec(connectionString, "DELETE FROM franchise WHERE name LIKE 'Gap Franchise %'");
        }
    }

    [Fact]
    public async Task ShowsAndLibrary_CoverProgressListsAndPurge()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        var previousAdmin = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
        var previousFactory = CatalogDb.TmdbClientFactory;
        var adminEmail = $"gap-lib-admin-{Guid.NewGuid():N}@example.com";
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", adminEmail);
        var script = new ScriptedTmdb();
        CatalogDb.TmdbClientFactory = () => script.Service;
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth", new { action = "register", email = adminEmail, password = "vault-key", displayName = "Admin" })).StatusCode);
        var adminId = await CoverageSupport.Scalar<int>(connectionString, $"SELECT id FROM app_user WHERE email = '{adminEmail}'");
        var memberEmail = $"gap-lib-{Guid.NewGuid():N}@example.com";
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", "nobody@example.com");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth", new { action = "register", email = memberEmail, password = "vault-key", displayName = "Member" })).StatusCode);
        var memberId = await CoverageSupport.Scalar<int>(connectionString, $"SELECT id FROM app_user WHERE email = '{memberEmail}'");
        await using var scope = factory.Services.CreateAsyncScope();
        var shows = scope.ServiceProvider.GetRequiredService<ShowGuideService>();
        var library = scope.ServiceProvider.GetRequiredService<UserLibraryService>();
        var franchises = scope.ServiceProvider.GetRequiredService<FranchiseCatalogService>();
        var stamp = Guid.NewGuid().ToString("N")[..8];
        var user = new AuthUserDto(memberId, memberEmail, "Member", false);
        var admin = new AuthUserDto(adminId, adminEmail, "Admin", true);
        try
        {
            await CoverShows(connectionString, shows, script, user, stamp);
            await CoverLibrary(connectionString, library, franchises, user, admin, stamp);
        }
        finally
        {
            CatalogDb.TmdbClientFactory = previousFactory;
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", previousAdmin);
            UserLibraryService.Clock = null;
        }
    }

    private static async Task CoverShows(string connectionString, ShowGuideService shows, ScriptedTmdb script, AuthUserDto user, string stamp)
    {
        var plain = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ('Plain {stamp}', 0, 0, 0, FALSE) RETURNING id");
        script.ShowSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchTv> { Results = null });
        Assert.NotNull(await shows.GetGuideAsync(user, $"show:{plain}", null, CancellationToken.None));
        script.ShowSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchTv> { Results = [] });
        Assert.Equal(0, await shows.RefreshFromTmdbAsync(plain, CancellationToken.None));

        var titled = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ('Matched {stamp}', 0, 0, 0, FALSE, 1999) RETURNING id");
        script.ShowSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchTv>
        {
            Results =
            [
                new SearchTv { Id = 501, Name = "Other", FirstAirDate = new DateTime(2000, 1, 1) },
                new SearchTv { Id = 502, Name = $"Matched {stamp}", FirstAirDate = null },
                new SearchTv { Id = 503, Name = $"Matched {stamp}", FirstAirDate = new DateTime(1999, 6, 1) },
            ],
        });
        script.Shows[503] = Show(503, $"Matched {stamp}", 1999);
        script.Seasons[(503, 1)] = Season(1, null);
        Assert.NotNull(await shows.GetGuideAsync(user, $"show:{titled}", 1, CancellationToken.None));
        script.Seasons[(503, 1)] = Season(1, Episodes());
        await Gap.WithRenamedTable(connectionString, "user_media_progress", "user_media_progress_gap", async () =>
        {
            await shows.GetGuideAsync(user, $"show:{titled}", 1, CancellationToken.None);
        });

        var loose = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched) VALUES ('Loose {stamp}', 0, 0, 0, FALSE) RETURNING id");
        script.ShowSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<SearchTv>
        {
            Results = [new SearchTv { Id = 504, Name = "Different", FirstAirDate = new DateTime(2010, 1, 1) }],
        });
        script.Shows[504] = Show(504, "Different", 1800);
        Assert.NotNull(await shows.GetGuideAsync(user, $"show:{loose}", null, CancellationToken.None));

        var known = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, tmdbid, releaseyear) VALUES ('Known {stamp}', 0, 0, 0, FALSE, 505, 2011) RETURNING id");
        script.Shows[505] = Show(505, $"Known {stamp}", 2011);
        Assert.NotNull(await shows.GetGuideAsync(user, $"SHOW:{known}", null, CancellationToken.None));
        await shows.AttachImportedShowAsync(script.Service, known, 505, script.Shows[505], CancellationToken.None);

        var seasonId = await CoverageSupport.Scalar<int>(connectionString, $"SELECT id FROM show_season WHERE show_id = {titled} ORDER BY season_number LIMIT 1");
        var episodeId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({titled}, {seasonId}, 9, '   ', 0) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({titled}, 8, 'Empty') ON CONFLICT DO NOTHING");
        await shows.SetProgressAsync(user, new ShowProgressRequest { EpisodeId = episodeId, Completed = true, Dated = false }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { EpisodeId = episodeId, Completed = true, Dated = true, Year = 1800 }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { EpisodeId = episodeId, Completed = true, Dated = true, Year = 2014 }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { SeasonId = seasonId, Completed = true }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{plain}", Completed = true }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{titled}", Completed = false }, CancellationToken.None);
        await shows.SetProgressAsync(user, new ShowProgressRequest { EpisodeId = episodeId, Completed = false }, CancellationToken.None);
        Assert.Throws<InvalidOperationException>(() => shows.SetProgressAsync(user, new ShowProgressRequest(), CancellationToken.None).GetAwaiter().GetResult());
        Assert.Throws<InvalidOperationException>(() => shows.GetGuideAsync(user, "movie:1", null, CancellationToken.None).GetAwaiter().GetResult());
        Assert.Throws<InvalidOperationException>(() => shows.SetProgressAsync(user, new ShowProgressRequest { SeasonId = 99999999, Completed = true }, CancellationToken.None).GetAwaiter().GetResult());
        Assert.Throws<InvalidOperationException>(() => shows.SetProgressAsync(user, new ShowProgressRequest { EpisodeId = 99999999, Completed = true }, CancellationToken.None).GetAwaiter().GetResult());
        shows.PurgeShow("movie:1");
        shows.PurgeShow("show:0");
        shows.PurgeShow(null);
        await CoverageSupport.Exec(connectionString, $"""
            INSERT INTO show_season (show_id, season_number, title)
            SELECT s.id, 90, 'Gap purge'
            FROM show s
            WHERE s.id = {plain}
              AND NOT EXISTS (SELECT 1 FROM show_season e WHERE e.show_id = s.id AND e.season_number = 90);
            INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime)
            SELECT s.show_id, s.id, 90, 'Gap purge', 1
            FROM show_season s
            WHERE s.show_id = {plain} AND s.season_number = 90
              AND NOT EXISTS (SELECT 1 FROM show_episode e WHERE e.season_id = s.id AND e.episode_number = 90);
            CREATE OR REPLACE FUNCTION gap_purge_boom() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              RAISE EXCEPTION 'gap purge';
            END $$;
            DROP TRIGGER IF EXISTS gap_purge_boom ON show_episode;
            CREATE TRIGGER gap_purge_boom BEFORE DELETE ON show_episode
            FOR EACH ROW EXECUTE FUNCTION gap_purge_boom();
            """);
        try
        {
            shows.PurgeShow($"show:{plain}");
        }
        finally
        {
            await CoverageSupport.Exec(connectionString, "DROP TRIGGER IF EXISTS gap_purge_boom ON show_episode");
        }
        await Gap.WithRenamedTable(connectionString, "user_media_progress", "user_media_progress_gap", async () =>
        {
            await shows.SetProgressAsync(user, new ShowProgressRequest { Id = $"show:{known}", Completed = false }, CancellationToken.None);
        });
        Assert.Equal(string.Empty, Gap.Call(shows, "ReadShowTitle", 99999999));
    }

    private static async Task CoverLibrary(string connectionString, UserLibraryService library, FranchiseCatalogService franchises, AuthUserDto user, AuthUserDto admin, string stamp)
    {
        var now = new DateTime(2026, 10, 16);
        var seed = unchecked((uint)(114246049 * 10_000 + now.Year * 400 + now.Month * 32 + now.Day));
        Assert.Equal(0u, seed);
        var shuffle = typeof(UserLibraryService).GetMethod("ShuffleWatchNext", BindingFlags.NonPublic | BindingFlags.Static)!;
        var list = Activator.CreateInstance(shuffle.GetParameters()[0].ParameterType)!;
        var pickType = typeof(UserLibraryService).GetNestedType("WatchNextPick", BindingFlags.NonPublic)!;
        var add = list.GetType().GetMethod("Add")!;
        add.Invoke(list, [Activator.CreateInstance(pickType, "movie:1", "One", "movie", "vault", null, "/a.jpg")]);
        add.Invoke(list, [Activator.CreateInstance(pickType, "movie:2", "Two", "movie", "vault", " ", null)]);
        UserLibraryService.Clock = () => now;
        shuffle.Invoke(null, [list, 114246049]);
        UserLibraryService.Clock = null;
        shuffle.Invoke(null, [list, 1]);
        Assert.Null(Gap.Call(typeof(UserLibraryService), "WatchNextItem", "movie", 0, "Title", "/p.jpg", "vault", "detail"));
        Assert.Null(Gap.Call(typeof(UserLibraryService), "WatchNextItem", "movie", 1, " ", "/../x", "vault", " "));
        Assert.NotNull(Gap.Call(typeof(UserLibraryService), "WatchNextItem", "movie", 1, "Title", "/" + new string('p', 180), "vault", "detail"));
        Assert.NotNull(Gap.Call(typeof(UserLibraryService), "WatchNextItem", "movie", 1, "Title", "/ok.jpg", "vault", null));

        await CoverageSupport.Exec(connectionString, "ALTER TABLE movie ALTER COLUMN releaseyear DROP NOT NULL; ALTER TABLE show ALTER COLUMN releaseyear DROP NOT NULL;");
        var seriesId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched, posterpath) VALUES ('Gap Lib Series {stamp}', 0, 1, FALSE, '/series.jpg') RETURNING id");
        var movieId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Lib Movie {stamp}', 10, FALSE, NULL, TRUE, {seriesId}, NULL) RETURNING id");
        var movieTwo = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid, posterpath) VALUES ('Gap Lib Next {stamp}', 10, FALSE, 0, TRUE, {seriesId}, '-') RETURNING id");
        var showId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, posterpath) VALUES ('Gap Lib Show {stamp}', 0, 1, 1, FALSE, NULL) RETURNING id");
        var seasonId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_season (show_id, season_number, title) VALUES ({showId}, 0, 'Specials') RETURNING id");
        var episodeId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({showId}, {seasonId}, 1, 'Cold Open', 20) RETURNING id");
        var episodeTwo = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO show_episode (show_id, season_id, episode_number, title, runtime) VALUES ({showId}, {seasonId}, 2, '   ', 20) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_episode_progress (user_id, episode_id, completed_at) VALUES ({user.Id}, {episodeId}, NULL)");
        var bookId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO book (title, pages, partofseries, releaseyear, read) VALUES ('Gap Lib Book {stamp}', 10, FALSE, 2000, FALSE) RETURNING id");
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"movie:{movieId}", Completed = true, Dated = true, Year = 2016 });
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"movie:{movieId}", Completed = false, Dated = false });
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"movie:{movieId}", Completed = true, Dated = true, Year = 1990 });
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"series:{seriesId}", Completed = true, Dated = false });
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"series:{seriesId}", Completed = false });
        await CoverageSupport.Exec(connectionString, $"INSERT INTO user_media_progress (user_id, media_kind, media_id, score, completed_at) VALUES ({user.Id}, 'book', {bookId}, 0, NULL), ({user.Id}, 'show', {showId}, 9, NOW()) ON CONFLICT DO NOTHING");
        CatalogDb.TmdbClientFactory = () => throw new InvalidOperationException("posters down");
        Assert.NotNull(library.GetProgress(user));
        CatalogDb.TmdbClientFactory = () => new ScriptedTmdb().Service;
        Assert.NotNull(library.GetProgress(user));
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"book:{bookId}", Completed = true, Score = JsonDocument.Parse("3").RootElement });
        library.SetCompleted(user, new ProgressWriteRequest { Id = $"book:{bookId}", Completed = true, Score = JsonDocument.Parse("null").RootElement });
        Assert.Throws<InvalidOperationException>(() => library.SetCompleted(user, new ProgressWriteRequest { Id = $"book:{bookId}", Score = JsonDocument.Parse("9").RootElement }));
        Assert.Throws<InvalidOperationException>(() => library.SetCompleted(user, new ProgressWriteRequest { Id = "movie:99999999", Score = JsonDocument.Parse("4").RootElement }));

        var lists = library.CreateList(user, new ListWriteRequest { Name = $"Gap List {stamp}" });
        var listId = lists.Single(item => item.Name == $"Gap List {stamp}").Id;
        library.RenameList(user, new ListWriteRequest { ListId = listId, Name = $"Gap List {stamp} b" });
        library.CreateList(user, new ListWriteRequest { Name = $"Gap List {stamp}" });
        library.RenameList(user, new ListWriteRequest { Id = listId, Visibility = "public" });
        Assert.Throws<InvalidOperationException>(() => library.RenameList(user, new ListWriteRequest { Id = 99999999, Visibility = "private" }));
        Assert.Throws<InvalidOperationException>(() => library.RenameList(user, new ListWriteRequest { Id = listId, Name = $"Gap List {stamp}", Visibility = "public" }));
        library.AddListItem(user, new ListWriteRequest { Id = listId, ItemId = $"series:{seriesId}" });
        library.AddListItem(user, new ListWriteRequest { ListId = listId, ItemId = $"book:{bookId}" });
        library.AddListItem(user, new ListWriteRequest { ListId = listId, ItemId = $"show:{showId}" });
        library.AddListItem(user, new ListWriteRequest { ListId = listId, ItemId = $"documentary:1" });
        var franchise = franchises.Create(new FranchiseWriteRequest { Name = $"Gap Lib Franchise {stamp}" });
        var franchiseId = franchise.Single(item => item.Name == $"Gap Lib Franchise {stamp}").Id;
        franchises.AddItem(new FranchiseWriteRequest { Id = franchiseId, ItemId = $"series:{seriesId}" });
        Assert.Throws<InvalidOperationException>(() => library.AddFranchise(user, new ListWriteRequest { ListId = listId, FranchiseId = franchiseId + 99999 }));
        var emptyFranchise = franchises.Create(new FranchiseWriteRequest { Name = $"Gap Empty Franchise {stamp}" });
        Assert.Throws<InvalidOperationException>(() => library.AddFranchise(user, new ListWriteRequest { Id = listId, FranchiseId = emptyFranchise.Single(item => item.Name == $"Gap Empty Franchise {stamp}").Id }));
        library.AddFranchise(user, new ListWriteRequest { ListId = listId, FranchiseId = franchiseId });
        library.AddFranchise(user, new ListWriteRequest { Id = listId, FranchiseId = franchiseId });
        library.RemoveFranchise(user, listId, franchiseId);
        Assert.Throws<InvalidOperationException>(() => library.RemoveFranchise(user, null, franchiseId));
        library.RemoveListItem(user, listId, $"series:{seriesId}");
        Assert.Throws<InvalidOperationException>(() => library.RemoveListItem(user, null, $"book:{bookId}"));
        Assert.Throws<InvalidOperationException>(() => library.AddListItem(user, new ListWriteRequest { Id = 99999999, ItemId = "movie:1" }));
        Assert.Throws<InvalidOperationException>(() => library.AddFranchise(user, new ListWriteRequest { ListId = listId, FranchiseId = 0 }));
        Assert.Throws<InvalidOperationException>(() => library.CreateList(user, new ListWriteRequest { Name = " " }));
        Assert.Throws<InvalidOperationException>(() => library.CreateList(user, new ListWriteRequest { Name = new string('L', 81) }));
        library.GetPublicLists(user.Id, false);
        await CoverageSupport.Exec(connectionString, "ALTER TABLE user_list ALTER COLUMN visibility DROP NOT NULL");
        await CoverageSupport.Exec(connectionString, $"UPDATE user_list SET visibility = NULL WHERE id = {listId}");
        Assert.NotNull(library.GetLists(user));
        await CoverageSupport.Exec(connectionString, $"UPDATE user_list SET visibility = 'PUBLIC' WHERE id = {listId}");
        Assert.NotNull(library.GetLists(user));
        await CoverageSupport.Exec(connectionString, $"UPDATE user_list SET visibility = 'nope' WHERE id = {listId}");
        Assert.NotNull(library.GetLists(user));
        await CoverageSupport.Exec(connectionString, $"UPDATE user_list SET visibility = 'private' WHERE id = {listId}");
        await CoverageSupport.Exec(connectionString, "ALTER TABLE user_list ALTER COLUMN visibility SET NOT NULL");

        await Gap.WithRenamedTable(connectionString, "show_episode", "show_episode_gap", () => Task.FromResult(library.GetProgress(user)));
        await Gap.WithRenamedTable(connectionString, "movieseries", "movieseries_gap", () => Task.FromResult(library.GetProgress(user)));
        await Gap.WithRenamedTable(connectionString, "movie", "movie_gap", () =>
        {
            Gap.Call(library, "AddSeriesMovies", listId, seriesId);
            Gap.Call(library, "RemoveSeriesMovies", listId, seriesId);
            Gap.Call(library, "CascadeSeriesMovies", user.Id, seriesId, true, true, 2010);
            Gap.Call(library, "SyncSeriesForMovie", user.Id, movieId, true, null);
            return Task.CompletedTask;
        });
        await Gap.WithRenamedTable(connectionString, "franchise_item", "franchise_item_gap", () =>
        {
            Assert.Throws<InvalidOperationException>(() => library.AddFranchise(user, new ListWriteRequest { ListId = listId, FranchiseId = franchiseId }));
            return Task.CompletedTask;
        });
        library.PurgeMedia($"movie:{movieTwo}");
        library.PurgeMedia($"show:{showId}");
        var owned = library.GetLists(user).Count;
        for (var i = owned; i < 40; i++)
        {
            library.CreateList(user, new ListWriteRequest { Name = $"Gap List {stamp} {i}" });
        }

        Assert.Throws<InvalidOperationException>(() => library.CreateList(user, new ListWriteRequest { Name = $"Gap List overflow {stamp}" }));
        library.DeleteList(user, listId);
        Assert.NotNull(library.GetCompletedIds(admin));
        var seedAdmin = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO app_user (email, display_name, password_hash, is_admin) VALUES ('gap-seed-{stamp}@example.test', 'Gap Seed', 'x', TRUE) RETURNING id");
        await Gap.WithRenamedTable(connectionString, "show", "show_gap", () =>
        {
            library.GetCompletedIds(new AuthUserDto(seedAdmin, $"gap-seed-{stamp}@example.test", "Gap Seed", true));
            return Task.CompletedTask;
        });
        Environment.SetEnvironmentVariable("HorrorVerseDb", " ");
        var bare = new UserLibraryService(new ConfigurationBuilder().Build(), new TmdbCatalogService(new ConfigurationBuilder().Build(), null!, null!, null!));
        Gap.Call(bare, "LoadWatchNextSafe", user.Id);
        Gap.Call(bare, "LoadReadNextSafe", user.Id);
        Environment.SetEnvironmentVariable("HorrorVerseDb", connectionString);
        _ = episodeTwo;
    }

    private static async Task SeedCatalogRows(string connectionString, string stamp)
    {
        await CoverageSupport.Exec(connectionString, "ALTER TABLE show ALTER COLUMN totaltime DROP NOT NULL; ALTER TABLE show ALTER COLUMN totalepisodes DROP NOT NULL; ALTER TABLE show ALTER COLUMN numberofseasons DROP NOT NULL; ALTER TABLE show ALTER COLUMN watched DROP NOT NULL;");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ('Gap Null Show {stamp}', NULL, NULL, NULL, NULL, NULL), ('Gap Zero Show {stamp}', 0, 0, 0, FALSE, 0), ('Gap Full Show {stamp}', 40, 2, 1, TRUE, 1999)");
        await CoverageSupport.Exec(connectionString, "CREATE TABLE IF NOT EXISTS podcast (id SERIAL PRIMARY KEY, title TEXT NOT NULL, releaseyear INTEGER NOT NULL, listened BOOLEAN NOT NULL); ALTER TABLE podcast ALTER COLUMN listened DROP NOT NULL; ALTER TABLE podcast ALTER COLUMN releaseyear DROP NOT NULL;");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO podcast (title, releaseyear, listened) VALUES ('Gap Null Pod {stamp}', NULL, NULL), ('Gap True Pod {stamp}', 1999, TRUE), ('Gap False Pod {stamp}', 0, FALSE)");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO book (title, pages, partofseries, releaseyear, read, author, description, coverurl, isbn, publisher) VALUES ('Gap Blank Book {stamp}', 0, FALSE, 0, FALSE, ' ', ' ', 'https://example.test/x.jpg', ' ', ' '), ('Gap Full Book {stamp}', 12, FALSE, 2001, TRUE, 'Author', 'Desc', 'https://covers.openlibrary.org/b/id/12-M.jpg', '123', 'Pub')");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO game (title, releaseyear, played, description, coverurl, developer, publisher, platforms) VALUES ('Gap Blank Game {stamp}', 0, FALSE, ' ', ' ', ' ', ' ', ' '), ('Gap Legacy Game {stamp}', 2001, TRUE, 'Desc', 'https://images.igdb.com/igdb/image/t_cover_big/abc.jpg', 'Dev', 'Pub', 'PC'), ('Gap Cover Game {stamp}', 2002, FALSE, NULL, 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg', NULL, NULL, NULL)");
        var seriesId = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES (' ', 0, 0, FALSE) RETURNING id");
        var namedSeries = await CoverageSupport.Scalar<int>(connectionString, $"INSERT INTO movieseries (title, totaltime, totalmovies, watched) VALUES ('Gap Map Series {stamp}', 0, 1, FALSE) RETURNING id");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries, seriesid) VALUES ('Gap Orphan {stamp}', 0, FALSE, 0, FALSE, NULL), ('Gap Linked Blank {stamp}', 0, FALSE, 0, TRUE, {seriesId}), ('Gap Linked Named {stamp}', 15, TRUE, 1980, TRUE, {namedSeries})");
        await CoverageSupport.Exec(connectionString, $"INSERT INTO documentary (title, totaltime, watched, releaseyear) VALUES ('Gap Zero Doc {stamp}', 0, FALSE, 0), ('Gap Full Doc {stamp}', 20, TRUE, 2010)");
    }

    private static TvShow Show(int id, string name, int year) => new()
    {
        Id = id,
        Name = name,
        NumberOfEpisodes = 2,
        NumberOfSeasons = 2,
        FirstAirDate = new DateTime(year, 1, 1),
        Seasons =
        [
            new SearchTvSeason { SeasonNumber = 0, Name = " " },
            new SearchTvSeason { SeasonNumber = 1, Name = null },
            new SearchTvSeason { SeasonNumber = 2, Name = "The Season" },
        ],
    };

    private static TvSeason Season(int number, List<TvSeasonEpisode>? episodes) => new()
    {
        SeasonNumber = number,
        Episodes = episodes,
    };

    private static List<TvSeasonEpisode> Episodes() =>
    [
        new TvSeasonEpisode { EpisodeNumber = 0, Name = "Skip" },
        new TvSeasonEpisode { EpisodeNumber = 1, Name = " ", Runtime = null, AirDate = null },
        new TvSeasonEpisode { EpisodeNumber = 2, Name = "Pilot", Runtime = 22, AirDate = new DateTime(1999, 5, 1) },
    ];

    private sealed class SpaApplication(string webRoot) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting(WebHostDefaults.WebRootKey, webRoot);
            builder.UseSetting("UseForwardedHeaders", "false");
            builder.UseSetting("ForceHttpsRedirection", "false");
        }
    }
}

internal static class Gap
{
    public static object? Call(object target, string name, params object?[] args)
    {
        var methods = target.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        var method = methods.SingleOrDefault(item => item.Name == name && item.GetParameters().Length == args.Length)
            ?? throw new MissingMethodException(target.GetType().Name, name + "(" + args.Length + ") " + string.Join(",", methods.Where(item => item.Name == name).Select(item => item.GetParameters().Length)));
        return Invoke(method, target, args);
    }

    public static object? Call(Type type, string name, params object?[] args)
    {
        var methods = type.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
        var method = methods.SingleOrDefault(item => item.Name == name && item.GetParameters().Length == args.Length)
            ?? throw new MissingMethodException(type.Name, name + "(" + args.Length + ")");
        return Invoke(method, null, args);
    }

    public static async Task CallAsync(object target, string name, params object?[] args)
    {
        if (Call(target, name, args) is Task task)
        {
            await task;
        }
    }

    public static void CallRead(CatalogService catalog)
    {
        var method = typeof(CatalogService).GetMethods(BindingFlags.Instance | BindingFlags.NonPublic).Single(item => item.Name == "Read");
        method.MakeGenericMethod(typeof(int)).Invoke(catalog, [(Func<IEnumerable<int>>)(() => throw new InvalidOperationException("gap")), "movies"]);
    }

    public static async Task WithRenamedTable(string connectionString, string table, string temporary, Func<Task> body)
    {
        await CoverageSupport.Exec(connectionString, $"ALTER TABLE {table} RENAME TO {temporary}");
        try
        {
            await body();
        }
        finally
        {
            await CoverageSupport.Exec(connectionString, $"ALTER TABLE {temporary} RENAME TO {table}");
        }
    }

    public static async Task WithRenamedColumn(string connectionString, string table, string column, string temporary, Func<Task> body)
    {
        await CoverageSupport.Exec(connectionString, $"ALTER TABLE {table} RENAME COLUMN {column} TO {temporary}");
        try
        {
            await body();
        }
        finally
        {
            await CoverageSupport.Exec(connectionString, $"ALTER TABLE {table} RENAME COLUMN {temporary} TO {column}");
        }
    }

    public static async Task WithIntegerColumn(string connectionString, string table, string column, Func<Task> body)
    {
        var temporary = column + "_gap";
        await CoverageSupport.Exec(connectionString, $"ALTER TABLE {table} RENAME COLUMN {column} TO {temporary}; ALTER TABLE {table} ADD COLUMN {column} integer; UPDATE {table} SET {column} = 1");
        try
        {
            await body();
        }
        finally
        {
            await CoverageSupport.Exec(connectionString, $"ALTER TABLE {table} DROP COLUMN {column}; ALTER TABLE {table} RENAME COLUMN {temporary} TO {column}");
        }
    }

    private static object? Invoke(MethodInfo method, object? target, object?[] args)
    {
        try
        {
            return method.Invoke(target, args);
        }
        catch (TargetInvocationException exception)
        {
            throw exception.InnerException!;
        }
    }
}
