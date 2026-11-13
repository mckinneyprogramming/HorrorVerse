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
                if (mode == "hide-501")
                {
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
                }

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
            await CoverageSupport.Exec(connectionString,
                $"INSERT INTO movie (title, totaltime, partofseries, releaseyear, watched, tmdbid) VALUES ('Talent Dup {stamp}', 90, false, 1978, false, 77)");
            var showId = Convert.ToInt32(await CoverageSupport.Scalar<object>(connectionString,
                $"INSERT INTO show (title, totaltime, totalepisodes, numberofseasons, watched, tmdbid) VALUES ('Talent Show {stamp}', 40, 1, 1, false, 80) RETURNING id"));
            var documentaryId = Convert.ToInt32(await CoverageSupport.Scalar<object>(connectionString,
                $"INSERT INTO documentary (title, totaltime, releaseyear, watched) VALUES ('Talent Doc {stamp}', 50, 2001, false) RETURNING id"));
            await CoverageSupport.Exec(connectionString,
                $"INSERT INTO documentary (title, totaltime, releaseyear, watched, tmdbid) VALUES ('Talent Doc Match {stamp}', 50, 2010, false, 78)");
            Assert.Equal(HttpStatusCode.OK, (await client.PatchAsJsonAsync("/api/progress", new { id = $"movie:{movieId}", completed = true, dated = true })).StatusCode);

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/talent?title=book:1")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/talent?title=movie")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/talent?title=movie:0")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/talent?title=movie:abc")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/talent?title=movie:999999")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/talent?person=nope")).StatusCode);
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
                credit.GetProperty("tmdbId").GetInt32() == 77
                && credit.GetProperty("finished").GetBoolean()
                && credit.GetProperty("vaultId").GetString() == $"movie:{movieId}");
            Assert.Contains(opened.GetProperty("person").GetProperty("credits").EnumerateArray(), credit =>
                credit.GetProperty("tmdbId").GetInt32() == 78
                && !credit.GetProperty("finished").GetBoolean()
                && credit.GetProperty("vaultId").GetString()!.StartsWith("documentary:", StringComparison.Ordinal));

            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/talent", new { personId = 500 })).StatusCode);
            var followed = await client.GetFromJsonAsync<JsonElement>("/api/talent?person=500");
            Assert.True(followed.GetProperty("person").GetProperty("following").GetBoolean());
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/talent", new { personId = 500 })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/talent", new { personId = 501 })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/talent", new { personId = 0 })).StatusCode);
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind, release_year, poster_path) VALUES (500, 'nope', 1, 'Skip', 'Cast', 'movie', NULL, NULL)");
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind) VALUES (500, 'movie', 0, 'Zero', 'Cast', 'movie')");
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind) VALUES (500, 'movie', 2, '', 'Cast', 'movie')");
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind) VALUES (500, 'movie', 3, 'Ok', 'Cast', 'book')");
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind) VALUES (500, 'movie', 4, 'Ok', '', 'movie')");
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind) VALUES (500, 'movie', 5, '" + new string('T', 201) + "', 'Cast', 'movie')");
            await CoverageSupport.Exec(connectionString, "INSERT INTO talent_filmography (person_id, media_type, tmdb_id, title, role, kind, release_year) VALUES (500, 'movie', 6, 'Bare', '" + new string('R', 121) + "', 'movie', 0)");
            await CoverageSupport.Exec(connectionString, "UPDATE talent_filmography SET poster_path = '/" + new string('a', 160) + "' WHERE person_id = 500 AND tmdb_id = 77");
            await CoverageSupport.Exec(connectionString, "UPDATE talent_filmography SET poster_path = '/h.jpg' WHERE person_id = 500 AND tmdb_id = 78");
            await CoverageSupport.Exec(connectionString, "UPDATE talent_filmography SET poster_path = 'plain.jpg', release_year = 0 WHERE person_id = 500 AND tmdb_id = 79");
            var userId = Convert.ToInt32(await CoverageSupport.Scalar<object>(connectionString, $"SELECT id FROM app_user WHERE email = 'talent-{stamp}@example.com'"));
            await CoverageSupport.Exec(connectionString, $"UPDATE user_talent_follow SET profile_path = '/../x' WHERE user_id = {userId} AND person_id = 500");
            await CoverageSupport.Exec(connectionString, $"UPDATE user_talent_follow SET profile_path = '   ' WHERE user_id = {userId} AND person_id = 501");
            await CoverageSupport.Exec(connectionString, $"INSERT INTO user_talent_follow (user_id, person_id, name) VALUES ({userId}, 7, 'Pat')");
            await CoverageSupport.Exec(connectionString, $"INSERT INTO user_talent_follow (user_id, person_id, name) VALUES ({userId}, 9, '')");
            await CoverageSupport.Exec(connectionString, $"INSERT INTO user_talent_follow (user_id, person_id, name) VALUES ({userId}, 8, '{new string('n', 201)}')");
            var people = await client.GetFromJsonAsync<JsonElement>("/api/talent");
            Assert.Contains(people.GetProperty("people").EnumerateArray(), person => person.GetProperty("id").GetInt32() == 500 && person.GetProperty("watched").GetInt32() == 1);
            await CoverageSupport.Exec(connectionString, $"UPDATE user_talent_follow SET known_for = '{new string('k', 50)}' WHERE user_id = {userId} AND person_id = 500");

            mode = "hide-501";
            var hidden = await client.GetFromJsonAsync<JsonElement>("/api/talent");
            Assert.Contains(hidden.GetProperty("people").EnumerateArray(), person => person.GetProperty("id").GetInt32() == 501 && person.GetProperty("total").GetInt32() == 0);
            mode = "ok";

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
