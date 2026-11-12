using System.Text.Json;

namespace HorrorTracker.Api.Catalog;

internal static class TalentFilmography
{
    public const int HorrorGenre = 27;
    public const int DocumentaryGenre = 99;

    public static (List<TalentName> Directors, List<TalentName> Cast) ReadTitle(JsonElement payload)
    {
        var directors = new List<TalentName>();
        var seenDirectors = new HashSet<int>();
        foreach (var item in Items(payload, "crew"))
        {
            if (directors.Count >= 4)
            {
                break;
            }

            if (!string.Equals(Text(item, "job"), "director", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!TryReadName(item, "Director", out var person) || !seenDirectors.Add(person.Id))
            {
                continue;
            }

            directors.Add(person);
        }

        var cast = new List<TalentName>();
        var seenCast = new HashSet<int>();
        var ranked = Items(payload, "cast")
            .Select((item, index) => (item, index))
            .OrderBy(pair => BillingOrder(pair.item))
            .ThenBy(pair => pair.index);
        foreach (var (item, _) in ranked)
        {
            if (cast.Count >= 8)
            {
                break;
            }

            var character = Clip(Text(item, "character"), 80);
            if (!TryReadName(item, string.IsNullOrEmpty(character) ? "Cast" : character, out var person) || !seenCast.Add(person.Id))
            {
                continue;
            }

            cast.Add(person);
        }

        return (directors, cast);
    }

    public static TalentSelection? ReadPerson(JsonElement payload)
    {
        var name = Clip(Text(payload, "name"), 200);
        if (string.IsNullOrEmpty(name))
        {
            return null;
        }

        var credits = new Dictionary<string, StoredCredit>();
        if (payload.TryGetProperty("combined_credits", out var combined) && combined.ValueKind == JsonValueKind.Object)
        {
            foreach (var item in Items(combined, "cast"))
            {
                var character = Clip(Text(item, "character"), 80);
                Remember(credits, item, string.IsNullOrEmpty(character) ? "Cast" : character);
            }

            foreach (var item in Items(combined, "crew"))
            {
                if (!string.Equals(Text(item, "job"), "director", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                Remember(credits, item, "Director");
            }
        }

        var knownFor = Clip(Text(payload, "known_for_department"), 40);
        var profilePath = Poster(Text(payload, "profile_path"));
        return new TalentSelection(
            name,
            profilePath,
            knownFor,
            credits.Values
                .OrderByDescending(credit => credit.Year ?? 0)
                .ThenBy(credit => credit.Title, StringComparer.Ordinal)
                .Take(120)
                .ToList());
    }

    private static void Remember(Dictionary<string, StoredCredit> credits, JsonElement item, string role)
    {
        var mediaType = Text(item, "media_type");
        if (mediaType is not ("movie" or "tv") || !TryId(item, "id", out var tmdbId) || !HasGenre(item, HorrorGenre))
        {
            return;
        }

        var title = Clip(FirstText(item, "title", "name"), 200);
        if (string.IsNullOrEmpty(title))
        {
            return;
        }

        var key = $"{mediaType}:{tmdbId}";
        var posterPath = Poster(Text(item, "poster_path"));
        var year = Year(FirstText(item, "release_date", "first_air_date"));
        var kind = mediaType == "tv" ? "show" : HasGenre(item, DocumentaryGenre) ? "documentary" : "movie";
        if (!credits.TryGetValue(key, out var existing))
        {
            credits[key] = new StoredCredit(tmdbId, mediaType, kind, title, year, posterPath, role);
            return;
        }

        existing.Role = MergeRole(existing.Role, role);
        existing.PosterPath ??= posterPath;
        existing.Year ??= year;
    }

    private static string MergeRole(string current, string next)
    {
        if (current == next || current.Split(" · ").Contains(next))
        {
            return current;
        }

        if (current == "Cast")
        {
            return next;
        }

        if (next == "Cast")
        {
            return current;
        }

        return $"{current} · {next}";
    }

    private static IEnumerable<JsonElement> Items(JsonElement payload, string name)
    {
        if (!payload.TryGetProperty(name, out var items) || items.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }

        foreach (var item in items.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Object)
            {
                yield return item;
            }
        }
    }

    private static bool TryReadName(JsonElement item, string role, out TalentName person)
    {
        person = new TalentName(0, "", role, null);
        var name = Clip(Text(item, "name"), 200);
        if (!TryId(item, "id", out var id) || string.IsNullOrEmpty(name))
        {
            return false;
        }

        person = new TalentName(id, name, role, Poster(Text(item, "profile_path")));
        return true;
    }

    private static int BillingOrder(JsonElement item)
    {
        if (item.TryGetProperty("order", out var order) && order.ValueKind == JsonValueKind.Number && order.TryGetInt32(out var value) && value >= 0)
        {
            return value;
        }

        return 10000;
    }

    private static bool HasGenre(JsonElement item, int genreId)
    {
        if (!item.TryGetProperty("genre_ids", out var genres) || genres.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        foreach (var genre in genres.EnumerateArray())
        {
            if (genre.ValueKind == JsonValueKind.Number && genre.TryGetInt32(out var id) && id == genreId)
            {
                return true;
            }
        }

        return false;
    }

    private static bool TryId(JsonElement item, string name, out int id)
    {
        id = 0;
        return item.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out id)
            && id > 0;
    }

    private static string Text(JsonElement item, string name)
    {
        if (!item.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            return "";
        }

        return value.GetString()!.Trim();
    }

    private static string FirstText(JsonElement item, string first, string second)
    {
        var text = Text(item, first);
        return text.Length > 0 ? text : Text(item, second);
    }

    private static string? Clip(string text, int max)
    {
        if (text.Length == 0)
        {
            return null;
        }

        return text.Length <= max ? text : text[..max].TrimEnd();
    }

    private static string? Poster(string path)
    {
        if (!path.StartsWith('/') || path.Length > 160 || path.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        foreach (var character in path)
        {
            if (!char.IsAsciiLetterOrDigit(character) && character is not ('.' or '_' or '/' or '-'))
            {
                return null;
            }
        }

        return path;
    }

    private static int? Year(string value)
    {
        if (value.Length < 4 || !int.TryParse(value[..4], out var year) || year < 1888 || year > 3000)
        {
            return null;
        }

        return year;
    }
}

internal sealed record TalentName(int Id, string Name, string Role, string? ProfilePath);

internal sealed class StoredCredit(int tmdbId, string mediaType, string kind, string title, int? year, string? posterPath, string role)
{
    public int TmdbId { get; } = tmdbId;
    public string MediaType { get; } = mediaType;
    public string Kind { get; } = kind;
    public string Title { get; } = title;
    public int? Year { get; set; } = year;
    public string? PosterPath { get; set; } = posterPath;
    public string Role { get; set; } = role;
}

internal sealed record TalentSelection(string Name, string? ProfilePath, string? KnownFor, IReadOnlyList<StoredCredit> Credits);
