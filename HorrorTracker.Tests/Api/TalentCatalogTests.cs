using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HorrorTracker.Api.Catalog;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HorrorTracker.Tests.Api;

public class TalentCatalogTests
{
    [Fact]
    public async Task TalentRoutes_FollowAPersonAndMatchFinishedVaultTitles()
    {
        if (!CoverageSupport.Ready(out var connectionString))
        {
            return;
        }

        await CoverageSupport.EnsureVault(connectionString);
        var stamp = Guid.NewGuid().ToString("N")[..8];
        var previous = Environment.GetEnvironmentVariable("TMDBKey");
        var previousSend = OutboundHttp.Send;
        var mode = "ok";
        OutboundHttp.Send = (request, _) =>
        {
            var url = request.RequestUri?.AbsoluteUri ?? "";
            if (mode == "throw")
            {
                throw new HttpRequestException("down");
            }

            if (mode == "bad-json")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("not-json"),
                });
            }

            if (url.Contains("/person/500", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json("""
                    {"id":500,"name":"Jamie","profile_path":"/j.jpg","known_for_department":"Acting",
                     "combined_credits":{"cast":[
                       {"id":77,"media_type":"movie","title":"Halloween","release_date":"1978-10-25","genre_ids":[27],"character":"Laurie","poster_path":"/h.jpg"},
                       {"id":78,"media_type":"movie","title":"Later","genre_ids":[27,99],"character":"Narrator"},
                       {"id":79,"media_type":"tv","name":"Zone","first_air_date":"2019-01-01","genre_ids":[27],"character":""},
                       {"id":80,"media_type":"movie","title":"Thriller","genre_ids":[53],"character":"Guest"}],
                     "crew":[{"id":77,"media_type":"movie","title":"Halloween","job":"Director","genre_ids":[27]}]}}
                    """));
            }

            if (url.Contains("/person/501", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json("""{"id":501,"name":"Quiet","combined_credits":{"cast":[],"crew":[]}}"""));
            }

            if (url.Contains("/person/404", StringComparison.Ordinal))
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            }

            if (url.Contains("/movie/77/credits", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json("""{"crew":[{"id":2,"name":"Carpenter","job":"Director","profile_path":"/c.jpg"}],"cast":[{"id":500,"name":"Jamie","character":"Laurie"}]}"""));
            }

            if (url.Contains("/tv/80/credits", StringComparison.Ordinal))
            {
                return Task.FromResult(CoverageSupport.Json("""{"crew":[{"id":3,"name":"Show Director","job":"Director"}],"cast":[]}"""));
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        };

        try
        {
            Environment.SetEnvironmentVariable("TMDBKey", null);
            await using var factory = new WebApplicationFactory<Program>();
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
            using var stranger = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
            Assert.Equal(HttpStatusCode.Unauthorized, (await stranger.GetAsync("/api/talent")).StatusCode);

            var email = $"talent-{stamp}@example.com";
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth", new { action = "register", email, password = "vault-key", displayName = "Talent" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talent?person=500")).StatusCode);

            Environment.SetEnvironmentVariable("TMDBKey", "test-key");
            var movieId = Convert.ToInt32(await CoverageSupport.Scalar<object>(connectionString,
                $"INSERT INTO movie (title, totaltime, partofseries, releaseyear, watched, tmdbid) VALUES ('Talent {stamp}', 90, false, 1978, false, 77) RETURNING id"));
            var showId = Convert.ToInt32(await CoverageSupport.Scalar<object>(connectionString,
                $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, tmdbid) VALUES ('Talent Show {stamp}', 40, 1, 1, false, 80) RETURNING id"));
            var documentaryId = Convert.ToInt32(await CoverageSupport.Scalar<object>(connectionString,
                $"INSERT INTO documentary (title, totaltime, releaseyear, watched) VALUES ('Talent Doc {stamp}', 50, 2001, false) RETURNING id"));
            Assert.Equal(HttpStatusCode.OK, (await client.PatchAsJsonAsync("/api/progress", new { id = $"movie:{movieId}", completed = true, dated = true })).StatusCode);

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/talent?title=book:1")).StatusCode);
            var movieCredits = await client.GetFromJsonAsync<JsonElement>($"/api/talent?title=movie:{movieId}");
            Assert.Equal("Carpenter", movieCredits.GetProperty("directors")[0].GetProperty("name").GetString());
            var showCredits = await client.GetFromJsonAsync<JsonElement>($"/api/talent?title=show:{showId}");
            Assert.Equal("Show Director", showCredits.GetProperty("directors")[0].GetProperty("name").GetString());
            var documentaryCredits = await client.GetFromJsonAsync<JsonElement>($"/api/talent?title=documentary:{documentaryId}");
            Assert.Equal(0, documentaryCredits.GetProperty("directors").GetArrayLength());
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talent?person=0")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talent?person=404")).StatusCode);

            var opened = await client.GetFromJsonAsync<JsonElement>("/api/talent?person=500");
            Assert.Equal(1, opened.GetProperty("person").GetProperty("watched").GetInt32());
            Assert.Contains(opened.GetProperty("person").GetProperty("credits").EnumerateArray(), credit =>
                credit.GetProperty("tmdbId").GetInt32() == 77 && credit.GetProperty("finished").GetBoolean());

            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/talent", new { personId = 500 })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/talent", new { personId = 501 })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/talent", new { personId = 0 })).StatusCode);
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind) VALUES (500, 'nope', 1, 'Skip', 'Cast', 'movie')");
            var people = await client.GetFromJsonAsync<JsonElement>("/api/talent");
            Assert.Contains(people.GetProperty("people").EnumerateArray(), person => person.GetProperty("id").GetInt32() == 500 && person.GetProperty("watched").GetInt32() == 1);

            mode = "throw";
            var thrown = await client.GetFromJsonAsync<JsonElement>($"/api/talent?title=movie:{movieId}");
            Assert.Equal(0, thrown.GetProperty("directors").GetArrayLength());
            mode = "bad-json";
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talent?person=500")).StatusCode);
            mode = "ok";

            Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/api/talent?person=500")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/api/talent?person=404")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync("/api/talent")).StatusCode);
            var remaining = await client.GetFromJsonAsync<JsonElement>("/api/talent");
            Assert.DoesNotContain(remaining.GetProperty("people").EnumerateArray(), person => person.GetProperty("id").GetInt32() == 500);
        }
        finally
        {
            Environment.SetEnvironmentVariable("TMDBKey", previous);
            OutboundHttp.Send = previousSend;
        }
    }
}
