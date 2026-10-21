using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace HorrorTracker.Tests.Api;

public class CatalogFlowTests
{
    [Fact]
    public async Task SignedInVault_KeepsListsPrivateAndPurgesDeletedTitles()
    {
        var connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb");
        if (string.IsNullOrWhiteSpace(connectionString)
            || !connectionString.Contains("Username=horror", StringComparison.OrdinalIgnoreCase)
            || !connectionString.Contains("Password=horror", StringComparison.Ordinal))
        {
            return;
        }

        await using (var connection = new NpgsqlConnection(connectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE IF NOT EXISTS Movie (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    TotalTime NUMERIC NOT NULL DEFAULT 0,
                    PartOfSeries BOOLEAN NOT NULL DEFAULT FALSE,
                    SeriesId INTEGER,
                    ReleaseYear INTEGER NOT NULL DEFAULT 0,
                    Watched BOOLEAN NOT NULL DEFAULT FALSE,
                    PosterPath TEXT
                );
                CREATE TABLE IF NOT EXISTS MovieSeries (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    TotalTime NUMERIC NOT NULL DEFAULT 0,
                    TotalMovies INTEGER NOT NULL DEFAULT 0,
                    Watched BOOLEAN NOT NULL DEFAULT FALSE,
                    PosterPath TEXT
                );
                CREATE TABLE IF NOT EXISTS Documentary (
                    Id SERIAL PRIMARY KEY,
                    Title TEXT NOT NULL,
                    TotalTime NUMERIC NOT NULL DEFAULT 0,
                    ReleaseYear INTEGER NOT NULL DEFAULT 0,
                    Watched BOOLEAN NOT NULL DEFAULT FALSE,
                    PosterPath TEXT
                );
                """;
            await command.ExecuteNonQueryAsync();
        }

        var previousAdmin = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
        var stamp = Guid.NewGuid().ToString("N")[..8];
        var adminEmail = $"ash-{stamp}@example.com";
        Environment.SetEnvironmentVariable("ADMIN_EMAIL", adminEmail);
        try
        {
            await using var factory = new WebApplicationFactory<Program>();
            using var admin = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
            using var member = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });

            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/auth", new
            {
                action = "register",
                email = adminEmail,
                password = "vault-key",
                displayName = "Ash",
            })).StatusCode);

            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth", new
            {
                action = "register",
                email = $"member-{stamp}@example.com",
                password = "vault-key",
                displayName = "Member",
            })).StatusCode);

            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/catalog", new
            {
                title = $"Halloween {stamp}",
                kind = "movie",
                completed = false,
                releaseYear = 1978,
            })).StatusCode);

            var created = await admin.PostAsJsonAsync("/api/catalog", new
            {
                title = $"Halloween {stamp}",
                kind = "movie",
                completed = false,
                releaseYear = 1978,
            });
            Assert.Equal(HttpStatusCode.OK, created.StatusCode);
            using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
            var id = createdJson.RootElement.GetProperty("id").GetString();
            Assert.False(string.IsNullOrWhiteSpace(id));

            Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync("/api/progress", new { id, completed = true })).StatusCode);
            var progress = await member.GetFromJsonAsync<JsonElement>("/api/progress");
            Assert.Contains(id!, progress.GetProperty("ids").EnumerateArray().Select(item => item.GetString()));

            var otherProgress = await admin.GetFromJsonAsync<JsonElement>("/api/progress");
            Assert.DoesNotContain(id!, otherProgress.GetProperty("ids").EnumerateArray().Select(item => item.GetString()));

            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { name = $"October {stamp}" })).StatusCode);
            var lists = await member.GetFromJsonAsync<JsonElement>("/api/lists");
            var listId = lists.GetProperty("lists")[0].GetProperty("id").GetInt32();
            Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/lists", new { listId, itemId = id })).StatusCode);

            var adminLists = await admin.GetFromJsonAsync<JsonElement>("/api/lists");
            Assert.Equal(0, adminLists.GetProperty("lists").GetArrayLength());

            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/catalog?id={Uri.EscapeDataString(id!)}")).StatusCode);
            var after = await member.GetFromJsonAsync<JsonElement>("/api/progress");
            Assert.DoesNotContain(id!, after.GetProperty("ids").EnumerateArray().Select(item => item.GetString()));
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", previousAdmin);
        }
    }
}
