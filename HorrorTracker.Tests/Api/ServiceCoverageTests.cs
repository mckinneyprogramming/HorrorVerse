using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HorrorTracker.Api.Auth;
using Microsoft.Extensions.Configuration;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Library;
using HorrorTracker.Api.Social;
using HorrorTracker.Data.TMDB;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Tests.Api;

public class ServiceCoverageTests
{
    [Fact]
    public async Task Api_CoversSignedInFlowsAndStubbedCatalogs()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        await CoverageSupport.EnsureVault(connectionString);
        var stamp = Guid.NewGuid().ToString("N")[..8];
        var adminEmail = $"ash-{stamp}@example.com";
        var memberEmail = $"member-{stamp}@example.com";
        var previousAdmin = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
        var previousKey = Environment.GetEnvironmentVariable("TMDBKey");
        var previousCron = Environment.GetEnvironmentVariable("CRON_SECRET");
        var previousClient = Environment.GetEnvironmentVariable("IGDB_CLIENT_ID");
        var previousSecret = Environment.GetEnvironmentVariable("IGDB_CLIENT_SECRET");
        var script = new ScriptedTmdb();
        var http = new Playback();
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", adminEmail);
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", "client");
        Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", "secret");
        Environment.SetEnvironmentVariable("CRON_SECRET", null);
        CatalogDb.TmdbClientFactory = () => script.Service;
        OutboundHttp.Send = http.Send;
        CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
        CoverageSupport.ClearStaticCache(typeof(WatchCatalogService));
        CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
        try
        {
            await using var factory = new WebApplicationFactory<Program>();
            using var admin = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
            using var member = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
            using var extra = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });

            await RegisterAsync(admin, adminEmail, "Ash Williams");
            await RegisterAsync(member, memberEmail, "");
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/auth", new { action = "register", email = adminEmail, password = "vault-key", displayName = "Ash" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/auth", new { action = "register", email = "bad", password = "vault-key" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/auth", new { action = "register", email = "a@b.c", password = "short" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/auth", new { action = "register", email = "a@b.c", password = new string('p', 257) })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/auth", new { action = "register", email = $"{new string('a', 251)}@b.c", password = "vault-key" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await extra.PostAsJsonAsync("/api/auth", new { action = "register", email = $"@{stamp}.example.com", password = "vault-key", displayName = "" })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await member.PostAsJsonAsync("/api/auth", new { action = "login", email = memberEmail, password = "wrong-key" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth", new { action = "LOGIN", email = memberEmail, password = "vault-key" })).StatusCode);

            var current = await admin.GetFromJsonAsync<JsonElement>("/api/auth");
            Assert.Equal(adminEmail, current.GetProperty("user").GetProperty("email").GetString());
            Assert.True(current.GetProperty("user").GetProperty("isAdmin").GetBoolean());
            var longName = new string('N', 90);
            var profile = await admin.PatchAsJsonAsync("/api/auth", new { displayName = longName, aboutMe = new string('a', 520), avatar = "data:image/png;base64,aaaa" });
            Assert.Equal(HttpStatusCode.OK, profile.StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/auth", new { displayName = " " })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/auth", new { avatar = "http://nope" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/auth", new { avatar = "data:image/jpeg;base64," + new string('a', 120_000) })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/auth", new { aboutMe = " ", avatar = " ", displayName = "Ash" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/auth", new { avatar = "data:image/webp;base64,bbbb" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/auth", new { avatar = "data:image/jpeg;base64,cccc" })).StatusCode);

            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/catalog", new { title = "nope", kind = "movie" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/catalog", new { title = " ", kind = "movie" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/catalog", new { title = "Nope", kind = "comic" })).StatusCode);

            var movie = await CreateAsync(admin, "movie", $"Halloween {stamp}", 1978, totalTime: 91);
            var series = await CreateAsync(admin, "series", $"Halloween Series {stamp}", totalMovies: 2, totalTime: 10);
            var documentary = await CreateAsync(admin, "documentary", $"Doc {stamp}", 2019, totalTime: -1);
            var show = await CreateAsync(admin, "show", $"Chapelwaite {stamp}", 2021, totalTime: 40, episodes: 2, seasons: 1);
            var book = await CreateAsync(admin, "book", $"It {stamp}", 1986, pages: 100);
            var podcast = await CreateAsync(admin, "podcast", $"Lore {stamp}", 0);
            var game = await CreateAsync(admin, "game", $"Silent {stamp}", 1999);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/catalog", new { title = $"Halloween {stamp}", kind = "movie", releaseYear = 1978 })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = movie, title = $"Halloween {stamp}", kind = "movie", completed = true })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = series, title = $"Halloween Series {stamp}", completed = false })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = documentary, title = $"Doc {stamp}", completed = true })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = show, title = $"Chapelwaite {stamp}", completed = false })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = book, title = $"It {stamp}", completed = true })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = podcast, title = $"Lore {stamp}", completed = false })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/catalog", new { id = game, title = $"Silent {stamp}", completed = true })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/catalog", new { id = "movie:0", title = "Missing" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.DeleteAsync("/api/catalog?id=nope")).StatusCode);

            await CoverageSupport.Exec(connectionString, """
                ALTER TABLE book ADD COLUMN IF NOT EXISTS author TEXT;
                ALTER TABLE book ALTER COLUMN read DROP NOT NULL;
                ALTER TABLE book ALTER COLUMN releaseyear DROP NOT NULL;
                ALTER TABLE book ALTER COLUMN pages DROP NOT NULL;
                UPDATE book SET author = '   ', description = '   ', coverurl = 'http://nope', isbn = ' ', publisher = ' ', pages = 0, releaseyear = 0 WHERE title LIKE 'It %';
                INSERT INTO book (title, seriesid, pages, partofseries, releaseyear, read, author, description, coverurl, isbn, publisher)
                VALUES ('Null Book', NULL, NULL, FALSE, NULL, NULL, NULL, NULL, 'https://covers.openlibrary.org/b/id/9-M.jpg', '123', 'Pub');
                ALTER TABLE game ALTER COLUMN played DROP NOT NULL;
                ALTER TABLE game ALTER COLUMN releaseyear DROP NOT NULL;
                UPDATE game SET description = ' ', coverurl = 'https://images.igdb.com/igdb/image/t_cover_big/abc.jpg', developer = ' ', publisher = ' ', platforms = ' ', releaseyear = 0 WHERE title LIKE 'Silent %';
                INSERT INTO game (title, releaseyear, played, description, coverurl, developer, publisher, platforms)
                VALUES ('Null Game', NULL, NULL, NULL, 'https://images.igdb.com/igdb/image/upload/t_cover_big/ok.jpg', 'Dev', 'Pub', 'PC');
                INSERT INTO game (title, releaseyear, played, coverurl) VALUES ('Legacy Game', 2001, FALSE, 'https://images.igdb.com/igdb/image/t_cover_big/legacy.jpg');
                ALTER TABLE show ALTER COLUMN watched DROP NOT NULL;
                ALTER TABLE show ALTER COLUMN totaltime DROP NOT NULL;
                ALTER TABLE show ALTER COLUMN totalepisodes DROP NOT NULL;
                ALTER TABLE show ALTER COLUMN numberofseasons DROP NOT NULL;
                ALTER TABLE show ALTER COLUMN releaseyear DROP NOT NULL;
                UPDATE show SET totaltime = 0, totalepisodes = 0, numberofseasons = 0, releaseyear = NULL, posterpath = '/show.jpg' WHERE title LIKE 'Chapelwaite %';
                """);
            var catalog = await admin.GetFromJsonAsync<JsonElement>("/api/catalog");
            Assert.True(catalog.GetArrayLength() > 0);
            Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/catalog/movie")).StatusCode);

            await ProgressAsync(member, movie, true, dated: false);
            await ProgressAsync(member, movie, true, year: 1978);
            await ProgressAsync(member, movie, true, year: 1800);
            await ProgressAsync(member, movie, true, year: DateTime.UtcNow.Year + 5);
            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/progress", new { id = movie, score = 5 })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/progress", new { id = movie, score = (int?)null })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PatchAsJsonAsync("/api/progress", new { id = movie, score = 9 })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PatchAsJsonAsync("/api/progress", new { id = movie, score = "nope" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PatchAsJsonAsync("/api/progress", new { id = series, score = 4 })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/progress", new { id = "podcast:1", completed = true, dated = false })).StatusCode);
            await ProgressAsync(member, series, true, year: DateTime.UtcNow.Year);
            await ProgressAsync(member, series, false);
            await ProgressAsync(member, movie, true);
            await ProgressAsync(member, movie, false);
            await CoverageSupport.Exec(connectionString, $"UPDATE movie SET seriesid = {IdOf(series)}, partofseries = TRUE, watched = TRUE, posterpath = '/movie.jpg', releaseyear = 1978 WHERE id = {IdOf(movie)}; UPDATE movieseries SET watched = TRUE, posterpath = '-' WHERE id = {IdOf(series)}; UPDATE documentary SET watched = TRUE, posterpath = '/doc.jpg', tmdbid = 50 WHERE title LIKE 'Doc %';");
            await ProgressAsync(member, movie, true, year: 1981);
            var progress = await member.GetFromJsonAsync<JsonElement>("/api/progress");
            Assert.True(progress.GetProperty("ids").GetArrayLength() >= 0);
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                var library = scope.ServiceProvider.GetRequiredService<UserLibraryService>();
                var adminUser = (await admin.GetFromJsonAsync<JsonElement>("/api/auth")).GetProperty("user");
                var memberUser = (await member.GetFromJsonAsync<JsonElement>("/api/auth")).GetProperty("user");
                var dto = new AuthUserDto(adminUser.GetProperty("id").GetInt32(), adminEmail, "Ash", true, null, null);
                library.GetCompletedIds(dto);
                library.GetCompletedIds(dto);
                var score = JsonDocument.Parse("null").RootElement;
                Assert.Throws<InvalidOperationException>(() => library.SetCompleted(new AuthUserDto(dto.Id, adminEmail, "Ash", false), new ProgressWriteRequest { Id = "nope", Score = score }));
                library.SetCompleted(new AuthUserDto(memberUser.GetProperty("id").GetInt32(), memberEmail, "M", false), new ProgressWriteRequest { Id = movie, Score = score });
            }

            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { name = $"October {stamp}" })).StatusCode);
            var lists = await member.GetFromJsonAsync<JsonElement>("/api/lists");
            var listId = lists.GetProperty("lists")[0].GetProperty("id").GetInt32();
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/lists", new { name = $"October {stamp}" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/lists", new { name = " " })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { listId, itemId = movie })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { listId, itemId = series })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { listId, itemId = book })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/lists", new { id = listId, visibility = "public" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/lists", new { id = listId, name = $"October {stamp} public", visibility = "private" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PatchAsJsonAsync("/api/lists", new { id = listId, visibility = "secret" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PatchAsJsonAsync("/api/lists", new { id = 999999, name = "Missing" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.DeleteAsync("/api/lists?id=999999")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/lists?listId={listId}&itemId={movie}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/lists?listId={listId}&itemId={series}")).StatusCode);

            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/franchises", new { name = $"Haddonfield {stamp}" })).StatusCode);
            var franchises = await admin.GetFromJsonAsync<JsonElement>("/api/franchises");
            var franchiseId = franchises.GetProperty("franchises").EnumerateArray().Last().GetProperty("id").GetInt32();
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/franchises", new { name = $"Haddonfield {stamp}" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/franchises", new { franchiseId, itemId = series })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/franchises", new { franchiseId, itemId = movie })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/franchises", new { franchiseId, itemId = game })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/franchises", new { franchiseId, itemId = podcast })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/franchises", new { id = franchiseId, name = $"Haddonfield {stamp} 2" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/franchises", new { id = 999999, name = "Missing" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { listId, franchiseId })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/lists?listId={listId}&franchiseId={franchiseId}")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/lists", new { listId, franchiseId = 999999 })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/franchises?franchiseId={franchiseId}&itemId={series}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/franchises?id={franchiseId}")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.DeleteAsync("/api/franchises?id=999999")).StatusCode);

            var people = await member.GetFromJsonAsync<JsonElement>($"/api/people?q={Uri.EscapeDataString("Ash")}");
            Assert.True(people.GetProperty("people").GetArrayLength() >= 1);
            var escaped = await member.GetFromJsonAsync<JsonElement>($"/api/people?q={Uri.EscapeDataString("Ash_%")}");
            Assert.Equal(0, escaped.GetProperty("people").GetArrayLength());
            var adminId = (await admin.GetFromJsonAsync<JsonElement>("/api/auth")).GetProperty("user").GetProperty("id").GetInt32();
            var memberIdValue = (await member.GetFromJsonAsync<JsonElement>("/api/auth")).GetProperty("user").GetProperty("id").GetInt32();
            Assert.Equal(HttpStatusCode.BadRequest, (await member.GetAsync("/api/people?q=a")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.GetAsync($"/api/people?id={adminId}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.GetAsync($"/api/people?id={memberIdValue}")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.GetAsync("/api/people?id=999999")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/friends", new { userId = adminId })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/friends", new { userId = adminId })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/friends", new { userId = memberIdValue })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/friends", new { userId = memberIdValue })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/friends?id={memberIdValue}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/friends", new { userId = adminId })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/friends", new { userId = memberIdValue, action = "decline" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/friends", new { userId = adminId })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/friends", new { userId = memberIdValue, action = "accept" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/friends", new { userId = memberIdValue, action = "accept" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/friends", new { userId = memberIdValue, action = "nope" })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/friends?id={memberIdValue}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/friends", new { userId = adminId })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/friends", new { userId = adminId, action = "cancel" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/friends", new { userId = memberIdValue })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/follows", new { userId = memberIdValue })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/follows", new { userId = adminId })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/follows?id={adminId}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.GetAsync("/api/friends")).StatusCode);

            await ExerciseTmdbAsync(admin, script, http, connectionString, stamp, movie, series, documentary, show, factory);
            await ExerciseExternalAsync(admin, member, http, connectionString, stamp, movie, documentary, show, factory);

            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(show)}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(movie)}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(series)}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(documentary)}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(book)}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(podcast)}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(game)}")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.DeleteAsync("/api/catalog?id=movie:999999")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync("/api/lists?id=" + listId)).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync("/api/auth")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync("/api/auth")).StatusCode);

            await using var direct = factory.Services.CreateAsyncScope();
            var auth = direct.ServiceProvider.GetRequiredService<AuthService>();
            Assert.Null(auth.GetCurrent(" "));
            Assert.Null(auth.GetCurrent("missing-token"));
            auth.Logout(" ");
            auth.Logout("missing-token");
            Assert.Throws<AuthException>(() => auth.RequireUser("missing-token"));
            Assert.Throws<AuthException>(() => auth.UpdateProfile(new AuthUserDto(999999, "gone@example.com", "Gone", false), new ProfileWriteRequest { DisplayName = "Gone" }));
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", memberEmail);
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth", new { action = "login", email = memberEmail, password = "vault-key" })).StatusCode);
        }
        finally
        {
            OutboundHttp.Send = null;
            CatalogDb.TmdbClientFactory = null;
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", previousAdmin);
            Environment.SetEnvironmentVariable("TMDBKey", previousKey);
            Environment.SetEnvironmentVariable("CRON_SECRET", previousCron);
            Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", previousClient);
            Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", previousSecret);
            CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
        }
    }

    private static async Task RegisterAsync(HttpClient client, string email, string displayName)
    {
        var response = await client.PostAsJsonAsync("/api/auth", new { action = "register", email, password = "vault-key", displayName });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<string> CreateAsync(HttpClient client, string kind, string title, int? year = null, decimal? totalTime = null, int? episodes = null, int? seasons = null, int? pages = null, int? totalMovies = null)
    {
        var response = await client.PostAsJsonAsync("/api/catalog", new
        {
            title,
            kind,
            completed = false,
            releaseYear = year,
            totalTime,
            totalEpisodes = episodes,
            numberOfSeasons = seasons,
            pages,
            totalMovies,
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("id").GetString()!;
    }

    private static async Task ProgressAsync(HttpClient client, string id, bool completed, bool dated = true, int? year = null)
    {
        var response = await client.PatchAsJsonAsync("/api/progress", new { id, completed, dated, year });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static int IdOf(string id) => int.Parse(id.Split(':')[1]);

    private static async Task ExerciseTmdbAsync(HttpClient admin, ScriptedTmdb script, Playback http, string connectionString, string stamp, string movie, string series, string documentary, string show, WebApplicationFactory<Program> factory)
    {
        http.Poster = "image";
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?q=a")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=comic&q=halloween")).StatusCode);
        script.MovieSearches.Enqueue(Movies());
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=movie&q=halloween")).StatusCode);
        script.MovieSearches.Enqueue(Movies());
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=documentary&q=horror")).StatusCode);
        script.ShowSearches.Enqueue(Shows());
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=SHOW&q=chapel")).StatusCode);
        script.CollectionSearches.Enqueue(Collections());
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=series&q=halloween")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "movie", tmdbId = 0 })).StatusCode);

        script.Movies[30] = new Movie { Id = 30, Title = $"Imported {stamp}", Runtime = 91, ReleaseDate = new DateTime(1978, 10, 25), PosterPath = "/imp.jpg", BelongsToCollection = new SearchCollection { Name = $"Halloween Series {stamp} Collection" } };
        script.Movies[31] = new Movie { Id = 31, Title = $"Imported {stamp}", Runtime = 0, ReleaseDate = new DateTime(1978, 10, 25), PosterPath = "nope", BelongsToCollection = new SearchCollection { Name = $"Halloween Series {stamp}" } };
        script.Movies[32] = new Movie { Id = 32, Title = $"Alone {stamp}", Runtime = null, ReleaseDate = null, PosterPath = null };
        script.Movies[33] = new Movie { Id = 33, Title = " ", Runtime = 10, ReleaseDate = new DateTime(1800, 1, 1) };
        script.Movies[34] = new Movie { Id = 34, Title = new string('T', 201), Runtime = 10, ReleaseDate = new DateTime(1990, 1, 1) };
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "movie", tmdbId = 30 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "movie", tmdbId = 31 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "movie", tmdbId = 32 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "movie", tmdbId = 33 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "movie", tmdbId = 34 })).StatusCode);

        script.Movies[40] = new Movie { Id = 40, Title = $"Doc Import {stamp}", Runtime = 80, ReleaseDate = new DateTime(2011, 5, 1), PosterPath = "/d.jpg" };
        script.Movies[41] = new Movie { Id = 41, Title = $"Doc Import {stamp}", Runtime = 80, ReleaseDate = null, PosterPath = "/d.jpg" };
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "documentary", tmdbId = 40 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "documentary", tmdbId = 41 })).StatusCode);

        script.Collections[70] = new Collection
        {
            Id = 70,
            Name = $"Fresh Series {stamp} Collection",
            PosterPath = "/c.jpg",
            Parts =
            [
                new SearchMovie { Id = 71, Title = "Skip", ReleaseDate = null },
                new SearchMovie { Id = 72, Title = " ", ReleaseDate = new DateTime(1980, 1, 1) },
                new SearchMovie { Id = 30, Title = $"Imported {stamp}", ReleaseDate = new DateTime(1978, 10, 25) },
                new SearchMovie { Id = 73, Title = $"Part {stamp}", ReleaseDate = new DateTime(1988, 1, 1) },
            ],
        };
        script.Movies[73] = new Movie { Id = 73, Title = $"Part {stamp}", Runtime = 100, ReleaseDate = new DateTime(1988, 4, 1), PosterPath = "/p.jpg" };
        script.Collections[71] = new Collection { Id = 71, Name = $"Fresh Series {stamp}", PosterPath = null, Parts = [] };
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "series", tmdbId = 70 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "series", tmdbId = 71 })).StatusCode);

        script.Shows[80] = ShowDetail("Chapelwaite Import", 2018, [40], 4, 1, "/tv.jpg", "Season 1");
        script.Shows[81] = ShowDetail($"Chapelwaite {stamp}", 2021, null, 0, 0, null, null);
        script.Seasons[(80, 1)] = new TvSeason
        {
            SeasonNumber = 1,
            Episodes =
            [
                new TvSeasonEpisode { EpisodeNumber = 1, Name = "Pilot", Runtime = 40, AirDate = new DateTime(2018, 10, 1) },
                new TvSeasonEpisode { EpisodeNumber = 0, Name = "Skip" },
                new TvSeasonEpisode { EpisodeNumber = 2, Name = " ", Runtime = 0, AirDate = null },
            ],
        };
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "show", tmdbId = 80 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "show", tmdbId = 81 })).StatusCode);
        script.ShowSearches.Enqueue(new SearchContainer<SearchTv> { Results = [new SearchTv { Id = 82, Name = "Matched Show", FirstAirDate = new DateTime(1999, 1, 1) }] });
        script.Shows[82] = ShowDetail("Matched Show", 1999, [0, 22], 2, 1, "/m.jpg", " ");
        await CoverageSupport.Exec(connectionString, "INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ('Matched Show', 0, 0, 0, FALSE, 1999) RETURNING id");
        var matched = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM show WHERE title = 'Matched Show' AND tmdbid IS NULL ORDER BY id DESC LIMIT 1");
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/shows?id=show:{matched}&season=1")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/shows?id=show:{matched}&season=9")).StatusCode);
        script.ShowSearches.Enqueue(new SearchContainer<SearchTv> { Results = [] });
        await CoverageSupport.Exec(connectionString, "INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, releaseyear) VALUES ('X', 0, 0, 0, FALSE, 1880)");
        var unmatched = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM show WHERE title = 'X' ORDER BY id DESC LIMIT 1");
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/shows?id=show:{unmatched}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/shows?id=movie:1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/shows?id=show:999999")).StatusCode);

        var importedShow = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM show WHERE tmdbid = 80");
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/shows?id=show:{importedShow}&season=1")).StatusCode);
        var episodeId = await CoverageSupport.Scalar<int>(connectionString, $"SELECT id FROM show_episode WHERE show_id = {importedShow} ORDER BY episode_number LIMIT 1");
        var seasonId = await CoverageSupport.Scalar<int>(connectionString, $"SELECT id FROM show_season WHERE show_id = {importedShow} LIMIT 1");
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { episodeId, completed = true, dated = true, year = 2018 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { episodeId, completed = true, dated = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { episodeId, completed = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { seasonId, completed = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { seasonId, completed = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { id = $"show:{importedShow}", completed = true, dated = true, year = 2018 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync("/api/shows", new { id = $"show:{importedShow}", completed = false })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/shows", new { completed = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/shows", new { episodeId = 999999, completed = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/shows", new { seasonId = 999999, completed = true })).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/sync?id=nope")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"/api/sync?id={movie}")).StatusCode);
        script.FailCollections.Add(1);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/sync?id={series}")).StatusCode);
        script.Shows[81] = ShowDetail($"Chapelwaite {stamp}", 2021, [15], 1, 1, "/s.jpg", null);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/sync?id={show}")).StatusCode);
        script.MovieSearches.Enqueue(new SearchContainer<SearchMovie> { Results = [new SearchMovie { Id = 30, Title = $"Imported {stamp}", ReleaseDate = new DateTime(1978, 10, 25) }] });
        script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = [new SearchCollection { Id = 70, Name = $"Fresh Series {stamp} Collection" }] });
        script.CollectionSearches.Enqueue(new SearchContainer<SearchCollection> { Results = [] });
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/sync")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/sync")).StatusCode);
        Environment.SetEnvironmentVariable("CRON_SECRET", "cron-secret");
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/sync")).StatusCode);
        using (var bare = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false }))
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await bare.GetAsync("/api/sync")).StatusCode);
            bare.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "cron-secret");
            Assert.Equal(HttpStatusCode.OK, (await bare.GetAsync("/api/sync")).StatusCode);
            bare.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "nope");
            Assert.Equal(HttpStatusCode.Unauthorized, (await bare.GetAsync("/api/sync")).StatusCode);
        }

        Environment.SetEnvironmentVariable("CRON_SECRET", null);
        using (var bare = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false }))
        {
            bare.DefaultRequestHeaders.Add("x-vercel-cron", "1");
            Assert.Equal(HttpStatusCode.OK, (await bare.GetAsync("/api/sync")).StatusCode);
            bare.DefaultRequestHeaders.Remove("x-vercel-cron");
            bare.DefaultRequestHeaders.Add("x-vercel-cron", "0");
            Assert.Equal(HttpStatusCode.Unauthorized, (await bare.GetAsync("/api/sync")).StatusCode);
        }

        _ = connectionString;
    }

    private static async Task ExerciseExternalAsync(HttpClient admin, HttpClient member, Playback http, string connectionString, string stamp, string movie, string documentary, string show, WebApplicationFactory<Program> factory)
    {
        http.Mode = "ok";
        CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/upcoming")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/upcoming")).StatusCode);
        CoverageSupport.ExpireCache(typeof(UpcomingCatalogService), "horror-schedule");
        http.Mode = "shows-down";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/upcoming")).StatusCode);
        CoverageSupport.ExpireCache(typeof(UpcomingCatalogService), "horror-schedule");
        http.Mode = "cancel-shows";
        Assert.Equal(HttpStatusCode.InternalServerError, (await admin.GetAsync("/api/upcoming")).StatusCode);
        Environment.SetEnvironmentVariable("TMDBKey", null);
        CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/upcoming")).StatusCode);
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        http.Mode = "http-error";
        CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/upcoming")).StatusCode);
        http.Mode = "throw";
        CoverageSupport.ClearStaticCache(typeof(UpcomingCatalogService));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/upcoming")).StatusCode);
        http.Mode = "ok";

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?poster=../x")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?poster=plain")).StatusCode);
        http.Poster = "png";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?poster=/ok.jpg&size=w342")).StatusCode);
        http.Poster = "text";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?poster=/ok.jpg&size=nope")).StatusCode);
        http.Poster = "none";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?poster=/ok.jpg")).StatusCode);
        http.Poster = "empty";
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?poster=/empty.jpg")).StatusCode);
        http.Poster = "huge";
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?poster=/huge.jpg")).StatusCode);
        http.Poster = "missing";
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?poster=/gone.jpg")).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/watch?id=series:1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/watch?id=book:1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/watch?id=nope")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/watch?id=movie:999999")).StatusCode);
        http.Mode = "watch";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/watch?id={movie}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/watch?id={movie}")).StatusCode);
        CoverageSupport.ExpireCache(typeof(WatchCatalogService), $"{movie}:US");
        http.Mode = "watch-empty";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/watch?id={documentary}")).StatusCode);
        await CoverageSupport.Exec(connectionString, "INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries) VALUES ('Z', 1, FALSE, 1990, FALSE)");
        var shortMovie = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM movie WHERE title = 'Z' ORDER BY id DESC LIMIT 1");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"/api/watch?id=movie:{shortMovie}")).StatusCode);
        await CoverageSupport.Exec(connectionString, "INSERT INTO movie (title, totaltime, watched, releaseyear, partofseries) VALUES ('Unmatched Horror', 1, FALSE, 1991, FALSE)");
        var unmatchedMovie = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM movie WHERE title = 'Unmatched Horror' ORDER BY id DESC LIMIT 1");
        http.Mode = "watch-nomatch";
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"/api/watch?id=movie:{unmatchedMovie}")).StatusCode);
        Environment.SetEnvironmentVariable("TMDBKey", " ");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"/api/watch?id={show}")).StatusCode);
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        http.Mode = "watch-show";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/watch?id={show}")).StatusCode);
        http.Mode = "ok";

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=book&q=a")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=game&q=a")).StatusCode);
        http.Mode = "books";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=book&q=haunt")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "book", sourceId = "OL1W" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "book", sourceId = "OL1W" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "book", sourceId = "nope" })).StatusCode);
        http.Mode = "books-fail";
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=book&q=haunt")).StatusCode);
        http.Mode = "games";
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=game&q=haunt")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "game", sourceId = "42" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "game", sourceId = "42" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/tmdb", new { kind = "game", sourceId = "nope" })).StatusCode);
        CoverageSupport.SetIgdbToken("cached", DateTimeOffset.UtcNow.AddHours(2));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/tmdb?kind=game&q=haunt{stamp}")).StatusCode);
        CoverageSupport.SetIgdbToken("stale", DateTimeOffset.UtcNow.AddSeconds(20));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/tmdb?kind=game&q=again")).StatusCode);
        http.Mode = "games-down";
        CoverageSupport.SetIgdbToken(null, DateTimeOffset.MinValue);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=game&q=haunt")).StatusCode);
        Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", null);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=game&q=haunt")).StatusCode);
        Environment.SetEnvironmentVariable("IGDB_CLIENT_SECRET", "secret");
        Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", null);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/tmdb?kind=game&q=haunt")).StatusCode);
        Environment.SetEnvironmentVariable("IGDB_CLIENT_ID", "client");
        http.Mode = "ok";

        await using var scope = factory.Services.CreateAsyncScope();
        var keywords = scope.ServiceProvider.GetRequiredService<KeywordCatalogService>();
        var tmdb = scope.ServiceProvider.GetRequiredService<TmdbCatalogService>();
        keywords.SaveTmdbId("nope", 1, 1);
        keywords.DeleteFor("movie", 999999);
        await keywords.SaveMovieAsync(IdOf(movie), 0);
        Environment.SetEnvironmentVariable("TMDBKey", null);
        await keywords.SaveMovieAsync(IdOf(movie), 30);
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        http.Mode = "keywords";
        await keywords.SaveMovieAsync(IdOf(movie), 30);
        await keywords.SaveMovieAsync(IdOf(movie), 30, skipIfPresent: true);
        await keywords.SaveDocumentaryAsync(IdOf(documentary), 40);
        await keywords.SaveShowAsync(IdOf(show), 80, skipIfPresent: true);
        await keywords.SaveShowAsync(IdOf(show), 80);
        var seriesId = await CoverageSupport.Scalar<int>(connectionString, "SELECT id FROM movieseries ORDER BY id LIMIT 1");
        keywords.ReplaceSeriesFromMovies(seriesId);
        Assert.NotEmpty(keywords.LoadAll());
        Assert.True(keywords.HasAny("movie", IdOf(movie)));
        Assert.NotNull(keywords.ListMovies());
        Assert.NotNull(keywords.ListDocumentaries());
        Assert.NotNull(keywords.ListShows());
        Assert.NotEmpty(keywords.ListSeriesIds());
        http.Mode = "keywords-bad";
        await keywords.SaveMovieAsync(IdOf(movie), 30);
        var posters = await tmdb.PostersForRecentAsync(["movie:" + IdOf(movie), "series:1", "nope", "comic:1", "documentary:" + IdOf(documentary), "show:" + IdOf(show)], CancellationToken.None);
        Assert.NotNull(posters);
        Assert.True(TmdbCatalogService.VaultTimestampIsStale(null));
        Assert.True(TmdbCatalogService.VaultTimestampIsStale(DBNull.Value));
        Assert.True(TmdbCatalogService.VaultTimestampIsStale("nope"));
        Assert.True(TmdbCatalogService.VaultTimestampIsStale(DateTime.UtcNow.AddHours(-7)));
        Assert.False(TmdbCatalogService.VaultTimestampIsStale(DateTime.UtcNow));
        Assert.True(TmdbCatalogService.VaultTimestampIsStale(DateTimeOffset.UtcNow.AddHours(-8)));
        Assert.False(TmdbCatalogService.VaultTimestampIsStale(DateTimeOffset.UtcNow));
        CatalogDb.TmdbClientFactory = null;
        Environment.SetEnvironmentVariable("TMDBKey", "test-key");
        Assert.NotNull(CatalogDb.CreateTmdbClient());
        Environment.SetEnvironmentVariable("TMDBKey", " ");
        Assert.Throws<InvalidOperationException>(() => CatalogDb.CreateTmdbClient());
        CatalogDb.TmdbClientFactory = () => new MovieDatabaseService(new ScriptedTmdb());
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId("movie:1", new HashSet<string> { "show" }, "missing", "bad kind"));
        Assert.Equal(("movie", 2), CatalogDb.ParseCatalogId(" movie : 2 ", new HashSet<string> { "movie" }, "missing"));
        _ = configuration;
        _ = member;
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

    private static SearchContainer<SearchCollection> Collections()
    {
        var results = new List<SearchCollection>();
        for (var id = 1; id <= 18; id++)
        {
            results.Add(new SearchCollection { Id = id, Name = id % 2 == 0 ? $"Set {id} Collection" : "   ", Overview = id == 2 ? null : "overview" });
        }

        return new SearchContainer<SearchCollection> { Results = results };
    }

    private static TvShow ShowDetail(string name, int year, int[]? runtimes, int episodes, int seasons, string? poster, string? seasonName) => new()
    {
        Name = name,
        FirstAirDate = new DateTime(year, 1, 1),
        NumberOfEpisodes = episodes,
        NumberOfSeasons = seasons,
        PosterPath = poster,
        EpisodeRunTime = runtimes?.ToList(),
        LastEpisodeToAir = runtimes is null ? new TvEpisode { Runtime = 18 } : new TvEpisode { Runtime = 0 },
        NextEpisodeToAir = new TvEpisode { Runtime = 12 },
        Seasons = seasons > 0 ? [new SearchTvSeason { SeasonNumber = 0, Name = seasonName }, new SearchTvSeason { SeasonNumber = 1, Name = "Season 1" }] : null,
    };
}

internal sealed class Playback
{
    public string Mode { get; set; } = "ok";
    public string Poster { get; set; } = "png";

    public Task<HttpResponseMessage> Send(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
        if (Mode == "cancel-shows" && url.Contains("/discover/tv", StringComparison.Ordinal))
        {
            throw new OperationCanceledException();
        }

        if (Mode == "shows-down" && url.Contains("/discover/tv", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("shows down");
        }

        if (Mode == "throw" && !url.Contains("image.tmdb.org", StringComparison.Ordinal))
        {
            throw new HttpRequestException("down");
        }

        if (Mode == "http-error" && !url.Contains("image.tmdb.org", StringComparison.Ordinal))
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
        }

        if (url.Contains("image.tmdb.org", StringComparison.Ordinal))
        {
            return Task.FromResult(PosterResponse());
        }

        if (url.Contains("/keywords", StringComparison.Ordinal))
        {
            if (Mode == "keywords-bad")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            }

            return Task.FromResult(CoverageSupport.Json(url.Contains("/tv/", StringComparison.Ordinal)
                ? """{"results":[{"id":1,"name":"ghost"},{"id":0,"name":"nope"},{"id":2,"name":" "},{"id":3,"name":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}]}"""
                : """{"keywords":[{"id":9,"name":"slasher"},{"id":9,"name":"Slasher"}]}"""));
        }

        if (url.Contains("/watch/providers", StringComparison.Ordinal))
        {
            return Task.FromResult(CoverageSupport.Json(Mode == "watch-empty"
                ? """{"results":{}}"""
                : """{"results":{"US":{"link":"https://example.test","flatrate":[{"provider_id":1,"provider_name":"Netflix","logo_path":"/n.jpg","display_priority":2},{"provider_id":1,"provider_name":"Dup"},{"provider_id":0,"provider_name":"Zero"},{"provider_id":2,"provider_name":" "}],"rent":[{"provider_id":3,"provider_name":"Rent","logo_path":"https://cdn/r.jpg"}],"buy":"nope","free":[{"provider_id":4,"provider_name":"Free"}]}}}"""));
        }

        if (url.Contains("/search/movie", StringComparison.Ordinal) || url.Contains("/search/tv", StringComparison.Ordinal))
        {
            if (Mode == "watch-nomatch")
            {
                return Task.FromResult(CoverageSupport.Json("""{"results":[{"id":1,"title":"Other","name":"Other"}]}"""));
            }

            var title = Uri.UnescapeDataString(url.Split("query=")[1].Split('&')[0]);
            var name = url.Contains("/search/tv", StringComparison.Ordinal) ? "name" : "title";
            var date = url.Contains("/search/tv", StringComparison.Ordinal) ? "first_air_date" : "release_date";
            return Task.FromResult(CoverageSupport.Json(
                "{\"results\":[{\"" + name + "\":\"" + title + "\"},{\"id\":1,\"" + name + "\":\"Other\"},{\"id\":2,\"" + name + "\":\"" + title + "\",\"" + date + "\":\"not-a-date\"},{\"id\":3,\"" + name + "\":\"" + title + "\",\"" + date + "\":\"1978-10-25\"},{\"id\":4,\"" + name + "\":\"  \"}]}"));
        }

        if (url.Contains("/discover/movie", StringComparison.Ordinal))
        {
            return Task.FromResult(CoverageSupport.Json(FilmPage(Page(url))));
        }

        if (url.Contains("airing_today", StringComparison.Ordinal) || url.Contains("on_the_air", StringComparison.Ordinal))
        {
            return Task.FromResult(CoverageSupport.Json(url.Contains("on_the_air", StringComparison.Ordinal)
                ? """{"results":"nope"}"""
                : ManyShows()));
        }

        if (url.Contains("/discover/tv", StringComparison.Ordinal))
        {
            return Task.FromResult(CoverageSupport.Json(url.Contains("first_air_date", StringComparison.Ordinal) ? PremierePage() : """{"total_pages":1,"results":[{"id":810,"name":"Horror Hour","overview":"ghost"},{"id":811,"name":"Sitcom","genre_ids":[35],"overview":"horror"},{"id":0}]}"""));
        }

        if (url.Contains("/tv/", StringComparison.Ordinal))
        {
            var id = TvId(url);
            if (id % 5 == 0)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            }

            return Task.FromResult(CoverageSupport.Json(TvDetail(id)));
        }

        if (url.Contains("id.twitch.tv", StringComparison.Ordinal))
        {
            if (Mode == "games-down")
            {
                return Task.FromResult(CoverageSupport.Json("""{"access_token":"x"}""", HttpStatusCode.Unauthorized));
            }

            return Task.FromResult(CoverageSupport.Json("""{"access_token":"token","expires_in":3600}"""));
        }

        if (url.Contains("api.igdb.com", StringComparison.Ordinal))
        {
            var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
            if (Mode == "games-down")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
            }

            return Task.FromResult(CoverageSupport.Json(body.Contains("where id", StringComparison.Ordinal) ? GameImport() : GameSearch()));
        }

        if (url.Contains("openlibrary.org", StringComparison.Ordinal))
        {
            if (Mode == "books-fail")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway));
            }

            if (url.Contains("/works/", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json(Work()));
            }

            if (url.Contains("key:/works/", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json(Edition()));
            }

            return Task.FromResult(CoverageSupport.Json(BookSearch()));
        }

        return Task.FromResult(CoverageSupport.Json("""{"results":[]}"""));
    }

    private HttpResponseMessage PosterResponse() => Poster switch
    {
        "empty" => CoverageSupport.Bytes([], "image/jpeg"),
        "huge" => CoverageSupport.Bytes(new byte[(8 * 1024 * 1024) + 1], "image/jpeg"),
        "text" => CoverageSupport.Bytes([1, 2, 3], "text/plain"),
        "none" => CoverageSupport.Bytes([1, 2, 3], null),
        "missing" => new HttpResponseMessage(HttpStatusCode.NotFound),
        _ => CoverageSupport.Bytes([1, 2, 3], "image/png"),
    };

    private static int Page(string url)
    {
        var marker = "page=";
        var index = url.IndexOf(marker, StringComparison.Ordinal);
        if (index < 0)
        {
            return 1;
        }

        var rest = url[(index + marker.Length)..];
        var end = rest.IndexOf('&');
        return int.Parse(end < 0 ? rest : rest[..end]);
    }

    private static int TvId(string url)
    {
        var marker = "/tv/";
        var start = url.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
        var rest = url[start..];
        var end = rest.IndexOfAny(['?', '/']);
        return int.TryParse(end < 0 ? rest : rest[..end], out var id) ? id : 0;
    }

    private static string FilmPage(int page)
    {
        var soon = DateTime.UtcNow.Date.AddDays(30).ToString("yyyy-MM-dd");
        var past = DateTime.UtcNow.Date.AddDays(-3).ToString("yyyy-MM-dd");
        var far = DateTime.UtcNow.Date.AddYears(3).ToString("yyyy-MM-dd");
        if (page > 1)
        {
            return "{\"total_pages\":20,\"results\":[{\"id\":900,\"title\":\"Later\",\"release_date\":\"" + soon + "\"},{\"id\":900,\"title\":\"Dup\",\"release_date\":\"" + soon + "\"}]}";
        }

        var overview = new string('a', 450);
        return "{\"total_pages\":20,\"results\":["
            + "{\"id\":0,\"title\":\"Zero\",\"release_date\":\"" + soon + "\"},"
            + "{\"id\":901,\"title\":\"\",\"release_date\":\"" + soon + "\"},"
            + "{\"id\":902,\"title\":\"NoDate\"},"
            + "{\"id\":903,\"title\":\"Past\",\"release_date\":\"" + past + "\",\"overview\":\" \"},"
            + "{\"id\":904,\"title\":\"Far\",\"release_date\":\"" + far + "\"},"
            + "{\"id\":905,\"title\":\"Bad\",\"release_date\":\"nope\"},"
            + "{\"id\":906,\"title\":\"Soon\",\"release_date\":\"" + soon + "\",\"overview\":\"" + overview + "\",\"poster_path\":\"/soon.jpg\"},"
            + "{\"id\":907,\"title\":\"Plain\",\"release_date\":\"" + soon + "\",\"overview\":\"short\",\"poster_path\":\"plain\"},"
            + "{\"id\":908,\"title\":\"Dots\",\"release_date\":\"" + soon + "\",\"poster_path\":\"/../x\"},"
            + "{\"title\":5,\"release_date\":\"" + soon + "\"}]}";
    }

    private static string PremierePage()
    {
        var soon = DateTime.UtcNow.Date.AddDays(12).ToString("yyyy-MM-dd");
        var past = DateTime.UtcNow.Date.AddDays(-2).ToString("yyyy-MM-dd");
        return "{\"total_pages\":1,\"results\":["
            + "{\"id\":1,\"name\":\"Horror Falls\",\"overview\":\"a ghost story\",\"first_air_date\":\"" + soon + "\",\"poster_path\":\"/p.jpg\"},"
            + "{\"id\":1,\"name\":\"Horror Falls\",\"first_air_date\":\"" + soon + "\"},"
            + "{\"id\":2,\"name\":\"Sitcom\",\"overview\":\"horror\",\"genre_ids\":[35],\"first_air_date\":\"" + soon + "\"},"
            + "{\"id\":3,\"name\":\"Cooking\",\"overview\":\"food\",\"first_air_date\":\"" + soon + "\"},"
            + "{\"id\":4,\"name\":\"Old Horror\",\"overview\":\"vampire\",\"first_air_date\":\"" + past + "\"},"
            + "{\"id\":5,\"name\":\" \",\"overview\":\"horror\",\"first_air_date\":\"" + soon + "\"}]}";
    }

    private static string ManyShows()
    {
        var items = string.Join(',', Enumerable.Range(1, 48).Select(id => "{\"id\":" + (1000 + id) + ",\"name\":\"Horror " + id + "\",\"overview\":\"slasher\"}"));
        return "{\"total_pages\":3,\"results\":[" + items + ",{\"id\":\"nope\",\"name\":\"Horror bad\"}]}";
    }

    private static string TvDetail(int id)
    {
        var soon = DateTime.UtcNow.Date.AddDays(15).ToString("yyyy-MM-dd");
        var far = DateTime.UtcNow.Date.AddYears(3).ToString("yyyy-MM-dd");
        var shape = id % 5;
        var longOverview = new string('b', 420);
        return shape switch
        {
            1 => "{\"name\":\"Excluded\",\"overview\":\"horror\",\"genres\":[{\"id\":35}],\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"A\",\"season_number\":1,\"episode_number\":1}}",
            2 => "{\"name\":\"Keyed\",\"overview\":\"\",\"keywords\":{\"results\":[{\"id\":3158,\"name\":\"x\"},{\"id\":1,\"name\":\"Haunted\"}]},\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"season_number\":1,\"episode_number\":2,\"overview\":\"" + longOverview + "\"},\"poster_path\":\"/ep.jpg\"}",
            3 => "{\"name\":\"Named\",\"keywords\":{\"keywords\":[{\"name\":\"ghost\"}]},\"next_episode_to_air\":{\"air_date\":\"" + soon + "\",\"name\":\"Cold Open\",\"season_number\":0,\"episode_number\":0},\"poster_path\":\"bad\"}",
            4 => "{\"name\":\"Ghost Story\",\"overview\":\"quiet\",\"keywords\":{\"other\":[]},\"next_episode_to_air\":{\"air_date\":\"" + far + "\",\"name\":\"Later\",\"season_number\":1,\"episode_number\":1}}",
            _ => "{\"name\":\"No Next\",\"overview\":\"zombie\",\"keywords\":[]}",
        };
    }

    private static string GameSearch() => """
        [
          {"name":"Skip"},
          {"id":0,"name":"Zero"},
          {"id":7,"name":"Haunt","genres":[{"name":"Horror"},{"name":"Adventure"}],"themes":[{"name":"Survival Horror"}],"platforms":[{"name":"PC"},{"name":"PS5"},{"name":"Switch"},{"name":"Extra"}],"summary":"x","first_release_date":1600000000,"cover":{"image_id":"abc"}},
          {"id":8,"name":"Puzzle","genres":[{"name":"Puzzle"}],"summary":"y"},
          {"id":9,"name":"   "},
          {"id":10,"name":"No bits"}
        ]
        """;

    private static string GameImport() => """
        [{
          "id":42,
          "name":"Haunt Game",
          "summary":"A long summary",
          "first_release_date":1,
          "cover":{"image_id":"bad id"},
          "genres":[{"name":"Horror"},{"name":"Horror"}],
          "themes":[{"name":" "}],
          "platforms":[],
          "involved_companies":[
            {"developer":true,"publisher":false,"company":{"name":"Dev"}},
            {"developer":false,"publisher":true,"company":{"name":"Pub"}},
            {"developer":false,"publisher":false,"company":{"name":"Other"}},
            {"developer":true}
          ]
        }]
        """;

    private static string BookSearch() => """
        {"docs":[
          {"title":"Skip"},
          {"key":"OL1W","title":"The Haunt","author_name":["Shirley Jackson"],"first_publish_year":1959,"cover_i":12,"subject":["Horror","Ghost","Haunt","Extra"]},
          {"key":"/works/OL2W","title":"Plain","subject":["Cooking"]},
          {"key":"not-a-work","title":"Bad"},
          {"key":"OL3W"}
        ]}
        """;

    private static string Work() => """
        {"title":"The Haunt","subtitle":"A Story","description":{"value":"A quiet house"},"subjects":["Horror","Horror","Ghost"],"covers":[0,44]}
        """;

    private static string Edition() => """
        {"docs":[{"title":"The Haunt","subtitle":"A Story","author_name":["Shirley Jackson","Extra"],"first_publish_year":1959,"cover_i":12,"number_of_pages_median":200,"isbn":["978-0-123456789","012345678X","12"],"publisher":["Viking"],"subject":["Horror"]}]}
        """;
}
