using System.Text.Json;

namespace HorrorTracker.Tests.Api;

public class TalentFilmographyTests
{
    [Fact]
    public void ReadTitle_KeepsDirectorsAndTheFirstBilledCast()
    {
        using var document = JsonDocument.Parse("""
            {
              "crew": [null, {"id": 1, "name": " ", "job": "Director"}, {"name": "Missing", "job": "Director"},
                {"id": 2, "name": "Carpenter", "job": " Director ", "profile_path": "/c.jpg"},
                {"id": 2, "name": "Carpenter", "job": "Director"},
                {"id": 3, "name": "Assistant", "job": "Assistant Director"},
                {"id": 4, "name": "Two", "job": "Director", "profile_path": "/a b.jpg"},
                {"id": 5, "name": "Three", "job": "Director"},
                {"id": 6, "name": "Four", "job": "Director"},
                {"id": 7, "name": "Five", "job": "Director"}],
              "cast": [
                {"id": 1, "name": " ", "order": 1, "character": "Skip"},
                {"id": 9, "name": "Later", "order": 2, "character": "Z"},
                {"id": 8, "name": "First", "order": 0, "character": " LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL ", "profile_path": "/a.jpg"},
                {"id": 8, "name": "First", "order": 0, "character": "Again"},
                {"id": 10, "name": "Unbilled"},
                {"id": 17, "name": "Negative", "order": -1, "character": "N"},
                {"id": 11, "name": "Six", "order": 6},
                {"id": 12, "name": "Seven", "order": 7},
                {"id": 13, "name": "Eight", "order": 8},
                {"id": 14, "name": "Nine", "order": 9},
                {"id": 15, "name": "Ten", "order": 10},
                {"id": 16, "name": "Eleven", "order": 11}
              ]
            }
            """);

        var credits = TalentFilmographyReader.Read(document.RootElement);
        Assert.Equal([2, 4, 5, 6], credits.Directors.Select(person => person.Id));
        Assert.Equal(8, credits.Cast.Count);
        Assert.Equal("Cast", credits.Cast[2].Role);
        Assert.Equal(80, credits.Cast[0].Role.Length);
    }

    [Fact]
    public void ReadPerson_KeepsHorrorCredits()
    {
        using var bare = JsonDocument.Parse("""{"name":"Bare"}""");
        Assert.Empty(TalentFilmographyReader.ReadPerson(bare.RootElement)!.Credits);
        using var empty = JsonDocument.Parse("""{"name":" "}""");
        Assert.Null(TalentFilmographyReader.ReadPerson(empty.RootElement));
        using var list = JsonDocument.Parse("""{"name":"Busy","combined_credits":[]}""");
        Assert.Empty(TalentFilmographyReader.ReadPerson(list.RootElement)!.Credits);
        using var jamie = JsonDocument.Parse("""
            {"name":"Jamie","profile_path":"/j.jpg","known_for_department":"Acting","combined_credits":{"cast":[
              {"id":15,"media_type":"movie","title":"Halloween","release_date":"1978-10-25","genre_ids":[27],"character":"Laurie","poster_path":"/h.jpg"},
              {"id":15,"media_type":"movie","title":"Halloween","genre_ids":[27],"character":""},
              {"id":16,"media_type":"movie","title":"Doc","release_date":"2010-01-01","genre_ids":[27,99],"character":"Narrator"},
              {"id":17,"media_type":"tv","name":"Zone","first_air_date":"2019-04-01","genre_ids":[27],"character":""},
              {"id":18,"media_type":"movie","title":"Thriller","genre_ids":[53],"character":"Guest"},
              {"id":19,"media_type":"person","title":"Self","genre_ids":[27]},
              {"media_type":"movie","title":"No Id","genre_ids":[27]},
              {"id":22,"media_type":"movie","title":" ","genre_ids":[27]},
              {"id":30,"media_type":"movie","title":"Old","genre_ids":[27],"release_date":"1800-01-01","poster_path":"/a b.jpg","character":"A"},
              {"id":31,"media_type":"movie","title":"Alpha","genre_ids":[27],"release_date":"2021-01-01","character":"A"},
              {"id":32,"media_type":"movie","title":"Beta","genre_ids":[27],"release_date":"2021-01-01","character":"B"},
              {"id":33,"media_type":"movie","title":"No Genre","character":"A"},
              {"id":40,"media_type":"movie","title":"Undated","genre_ids":["x",27.5,27],"character":"A"}
            ],"crew":[
              {"id":15,"media_type":"movie","title":"Halloween","job":"Director","genre_ids":[27],"poster_path":"nope"},
              {"id":15,"media_type":"movie","title":"Halloween","job":"Director","genre_ids":[27]},
              {"id":20,"media_type":"movie","title":"Later","job":"Director","genre_ids":[27],"release_date":"2020-05-01","poster_path":"/later.jpg"},
              {"id":20,"media_type":"movie","title":"Later","job":"Director","genre_ids":[27]},
              {"id":17,"media_type":"tv","name":"Zone","job":"Director","genre_ids":[27]},
              {"id":34,"media_type":"movie","title":"No Job","genre_ids":[27]},
              {"id":40,"media_type":"movie","title":"Undated","job":"Director","genre_ids":[27],"release_date":"2011-01-01"}
            ]}}
            """);
        var film = TalentFilmographyReader.ReadPerson(jamie.RootElement)!;
        Assert.Equal("Laurie · Director", film.Credits.Single(credit => credit.TmdbId == 15).Role);
        Assert.Equal("documentary", film.Credits.Single(credit => credit.TmdbId == 16).Kind);
        Assert.Equal("Alpha", film.Credits.First(credit => credit.Year == 2021).Title);
        Assert.Equal(2011, film.Credits.Single(credit => credit.TmdbId == 40).Year);
        Assert.Null(film.Credits.Single(credit => credit.TmdbId == 30).Year);
        Assert.Null(film.Credits.Single(credit => credit.TmdbId == 30).PosterPath);

        var cast = string.Join(",", Enumerable.Range(1, 121).Select(id =>
            "{\"id\":" + id + ",\"media_type\":\"movie\",\"title\":\"Film " + id.ToString("000") + "\",\"release_date\":\"" + (1888 + id - 1) + "-01-01\",\"genre_ids\":[27],\"character\":\"A\"}"));
        using var many = JsonDocument.Parse("{\"name\":\"Busy\",\"combined_credits\":{\"cast\":[" + cast + "]}}");
        var capped = TalentFilmographyReader.ReadPerson(many.RootElement)!;
        Assert.Equal(120, capped.Credits.Count);
        Assert.Equal("Film 121", capped.Credits[0].Title);
    }
}

internal static class TalentFilmographyReader
{
    public static (List<HorrorTracker.Api.Catalog.TalentName> Directors, List<HorrorTracker.Api.Catalog.TalentName> Cast) Read(JsonElement payload)
        => HorrorTracker.Api.Catalog.TalentFilmography.ReadTitle(payload);

    public static HorrorTracker.Api.Catalog.TalentSelection? ReadPerson(JsonElement payload)
        => HorrorTracker.Api.Catalog.TalentFilmography.ReadPerson(payload);
}
