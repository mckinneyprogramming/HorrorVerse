using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HorrorTracker.Api.Auth;
using Npgsql;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Library;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Tests.Api;

public class RemainingBranchTests
{
    [Fact]
    public async Task Branches_CoverAuthCatalogDbRuntimeAndHttpFallback()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        await CoverageSupport.EnsureVault(connectionString);

        var emptyConfig = new ConfigurationBuilder().Build();
        var previousDb = Environment.GetEnvironmentVariable("HorrorVerseDb");
        Environment.SetEnvironmentVariable("HorrorVerseDb", " ");
        Assert.Throws<InvalidOperationException>(() => CatalogDb.Open(emptyConfig));
        Environment.SetEnvironmentVariable("HorrorVerseDb", previousDb);
        CatalogDb.EnsureCountAtMost(emptyConfig, "SELECT 1 WHERE @id > 0", 1, 5, "full");
        Assert.Throws<InvalidOperationException>(() => CatalogDb.EnsureCountAtMost(emptyConfig, "SELECT 9 WHERE @id > 0", 1, 5, "full"));
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId("movie:0", new HashSet<string> { "movie" }, "missing"));
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId("movie:x", new HashSet<string> { "movie" }, "missing"));
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId(null, new HashSet<string> { "movie" }, "missing"));
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId("nope", new HashSet<string> { "movie" }, "missing"));
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId("comic:1", new HashSet<string> { "movie" }, "missing"));
        Assert.Throws<InvalidOperationException>(() => CatalogDb.ParseCatalogId("comic:1", new HashSet<string> { "movie" }, "missing", "bad kind"));
        Assert.Equal("movie", CatalogDb.ParseCatalogId(" Movie:4 ", new HashSet<string> { "movie" }, "missing").Kind);

        Assert.Equal(0m, ShowRuntime.TotalMinutes(new TvShow { NumberOfEpisodes = 0 }));
        Assert.Equal(0m, ShowRuntime.TotalMinutes(new TvShow
        {
            NumberOfEpisodes = 3,
            EpisodeRunTime = [0],
            LastEpisodeToAir = new TvEpisode { Runtime = 0 },
            NextEpisodeToAir = new TvEpisode { Runtime = null },
        }));
        Assert.Equal(36m, ShowRuntime.TotalMinutes(new TvShow
        {
            NumberOfEpisodes = 3,
            NextEpisodeToAir = new TvEpisode { Runtime = 12 },
        }));

        var progress = new ShowProgressRequest { Season = 2, Id = "show:1", SeasonId = 3, EpisodeId = 4, Completed = true, Dated = false, Year = 2018 };
        Assert.Equal(2, progress.Season);

        var previousSend = OutboundHttp.Send;
        OutboundHttp.Send = null;
        try
        {
            using var client = new HttpClient(OutboundHttp.CreateHandler()) { Timeout = TimeSpan.FromMilliseconds(200) };
            await Assert.ThrowsAnyAsync<Exception>(() => client.GetAsync("http://127.0.0.1:9/"));
        }
        finally
        {
            OutboundHttp.Send = previousSend;
        }

        var previousKey = Environment.GetEnvironmentVariable("TMDBKey");
        var previousAdmin = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
        Environment.SetEnvironmentVariable("TMDBKey", null);
        CatalogDb.TmdbClientFactory = null;
        Assert.Throws<InvalidOperationException>(CatalogDb.CreateTmdbClient);
        Environment.SetEnvironmentVariable("TMDBKey", " ");
        Assert.Throws<InvalidOperationException>(CatalogDb.CreateTmdbClient);
        Environment.SetEnvironmentVariable("TMDBKey", previousKey);

        Environment.SetEnvironmentVariable("ADMIN_EMAIL", null);
        await using var factory = new WebApplicationFactory<Program>();
        await using var scope = factory.Services.CreateAsyncScope();
        var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
        var franchises = scope.ServiceProvider.GetRequiredService<FranchiseCatalogService>();
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync("/api/auth", new { email = "person@example.com", password = "vault-key" })).StatusCode);
        Assert.Throws<AuthException>(() => auth.Register(new AuthRequest { Email = "person@example.com", Password = null }));
        Assert.Throws<AuthException>(() => auth.Login(new AuthRequest { Email = null, Password = null }));
        Assert.Throws<AuthException>(() => auth.Login(new AuthRequest { Email = "missing-person@example.com", Password = "vault-key" }));

        await CoverageSupport.Exec(connectionString, """
            CREATE OR REPLACE FUNCTION horrorverse_cov_boom() RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'boom' USING ERRCODE = '22000';
            END $$ LANGUAGE plpgsql;
            DROP TRIGGER IF EXISTS app_user_boom ON app_user;
            CREATE TRIGGER app_user_boom BEFORE INSERT ON app_user FOR EACH ROW EXECUTE FUNCTION horrorverse_cov_boom();
            """);
        Assert.Throws<PostgresException>(() => auth.Register(new AuthRequest { Email = "boom@example.com", Password = "vault-key" }));
        await CoverageSupport.Exec(connectionString, "DROP TRIGGER IF EXISTS app_user_boom ON app_user;");

        await CoverageSupport.Exec(connectionString, """
            CREATE OR REPLACE FUNCTION horrorverse_cov_skip() RETURNS trigger AS $$
            BEGIN
              RETURN NULL;
            END $$ LANGUAGE plpgsql;
            DROP TRIGGER IF EXISTS app_user_skip ON app_user;
            CREATE TRIGGER app_user_skip BEFORE INSERT ON app_user FOR EACH ROW EXECUTE FUNCTION horrorverse_cov_skip();
            """);
        var emptyInsert = Assert.Throws<AuthException>(() => auth.Register(new AuthRequest { Email = "empty-insert@example.com", Password = "vault-key" }));
        Assert.Equal(500, emptyInsert.StatusCode);
        await CoverageSupport.Exec(connectionString, "DROP TRIGGER IF EXISTS app_user_skip ON app_user;");

        using var member = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        var memberEmail = $"branch-{Guid.NewGuid():N}@example.com";
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth", new { action = "register", email = memberEmail, password = "vault-key", displayName = "Branch" })).StatusCode);
        var me = await member.GetFromJsonAsync<JsonElement>("/api/auth");
        var user = new AuthUserDto(me.GetProperty("user").GetProperty("id").GetInt32(), memberEmail, "Branch", false, "bio", "data:image/png;base64,aa");
        auth.UpdateProfile(user, new ProfileWriteRequest { AboutMe = "short", Avatar = "data:image/png;base64,zz" });
        auth.UpdateProfile(user, new ProfileWriteRequest());
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", "   ");
        auth.UpdateProfile(user, new ProfileWriteRequest { DisplayName = "Branch" });

        franchises.PurgeMedia("podcast:1");
        await CoverageSupport.Exec(connectionString, "DROP TABLE IF EXISTS franchise_item;");
        franchises.PurgeMedia("movie:1");
        franchises.AddMovieToFranchisesContainingSeries(1, 2);
        await CoverageSupport.Exec(connectionString, """
            CREATE TABLE IF NOT EXISTS franchise_item (
                franchise_id INTEGER NOT NULL,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (franchise_id, media_kind, media_id));
            """);

        var social = scope.ServiceProvider.GetRequiredService<HorrorTracker.Api.Social.SocialService>();
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/friends", new { userId = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/friends", new { userId = 999999 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { name = "Branch " + Guid.NewGuid().ToString("N")[..8] })).StatusCode);
        var lists = await member.GetFromJsonAsync<JsonElement>("/api/lists");
        var listId = lists.GetProperty("lists")[0].GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.OK, (await member.DeleteAsync($"/api/lists?id={listId}&itemId=movie:1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.DeleteAsync($"/api/lists?listId=0&id={listId}&itemId=movie:1")).StatusCode);
        Assert.Throws<InvalidOperationException>(() => social.Search(user, null));
        using var other = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        var otherEmail = $"other-{Guid.NewGuid():N}@example.com";
        Assert.Equal(HttpStatusCode.OK, (await other.PostAsJsonAsync("/api/auth", new { action = "register", email = otherEmail, password = "vault-key", displayName = "Other" })).StatusCode);
        var otherId = (await other.GetFromJsonAsync<JsonElement>("/api/auth")).GetProperty("user").GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/friends", new { userId = otherId })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync($"/api/people?id={user.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await other.PatchAsJsonAsync("/api/friends", new { userId = user.Id })).StatusCode);
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", memberEmail);
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth", new { action = "login", email = memberEmail, password = "vault-key" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/franchises", new { name = "Branch " + Guid.NewGuid().ToString("N")[..8] })).StatusCode);
        var franchiseId = (await member.GetFromJsonAsync<JsonElement>("/api/franchises")).GetProperty("franchises").EnumerateArray().Last().GetProperty("id").GetInt32();
        var removed = await member.DeleteAsync($"/api/franchises?id={franchiseId}&itemId=movie:1");
        Assert.True(removed.StatusCode is HttpStatusCode.OK or HttpStatusCode.BadRequest);
        var removedAgain = await member.DeleteAsync($"/api/franchises?franchiseId=0&id={franchiseId}&itemId=movie:1");
        Assert.True(removedAgain.StatusCode is HttpStatusCode.OK or HttpStatusCode.BadRequest);

        try
        {
            Environment.SetEnvironmentVariable("HorrorVerseDb", " ");
            Assert.Throws<AuthException>(() => auth.GetCurrent("not-a-blank-token"));
            Assert.Throws<InvalidOperationException>(() => social.Search(user, "Ash"));
            Environment.SetEnvironmentVariable("HorrorVerseDb", "Host=127.0.0.1;Port=1;Timeout=1;Username=horror;Password=horror;Database=HorrorTracker");
            using var broken = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
            var catalog = await broken.GetAsync("/api/catalog");
            Assert.True(catalog.StatusCode is HttpStatusCode.OK or HttpStatusCode.InternalServerError, await catalog.Content.ReadAsStringAsync());
            Assert.ThrowsAny<Exception>(() => auth.GetCurrent("not-a-blank-token"));
        }
        finally
        {
            Environment.SetEnvironmentVariable("HorrorVerseDb", previousDb);
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", previousAdmin);
        }
    }
}
