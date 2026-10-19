using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed partial class OpenLibraryCatalogService(IConfiguration configuration)
{
    private const string UserAgent = "HorrorVerse/1.0 (https://horrorverse.vercel.app)";

    public async Task<object> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        var text = (query ?? string.Empty).Trim();
        if (text.Length < 2)
        {
            throw new InvalidOperationException("Enter at least two characters to search Open Library.");
        }

        var payload = await GetJsonAsync(
            $"/search.json?q={Uri.EscapeDataString(text)}&limit=20&fields=key,title,author_name,first_publish_year,cover_i,subject",
            cancellationToken);
        var hits = new List<(int Rank, object Hit)>();
        if (payload.TryGetProperty("docs", out var docs) && docs.ValueKind == JsonValueKind.Array)
        {
            foreach (var doc in docs.EnumerateArray())
            {
                if (!TryWorkId(doc, "key", out var sourceId))
                {
                    continue;
                }

                var title = Clean(doc, "title", 200);
                if (title is null)
                {
                    continue;
                }

                var subjects = Names(doc, "subject").ToList();
                var author = Join(doc, "author_name", 180);
                var overview = string.Join(" · ", new[] { author, string.Join(", ", subjects.Take(3)) }.Where(part => !string.IsNullOrWhiteSpace(part)));
                hits.Add((
                    subjects.Any(subject => HorrorSubjectPattern().IsMatch(subject)) ? 0 : 1,
                    new
                    {
                        sourceId,
                        title,
                        year = Year(doc, "first_publish_year"),
                        overview = string.IsNullOrWhiteSpace(overview) ? null : overview,
                        coverUrl = CoverUrl(doc, "cover_i")
                    }));
            }
        }

        return new { results = hits.OrderBy(hit => hit.Rank).Take(8).Select(hit => hit.Hit) };
    }

    public async Task<object> ImportAsync(string? sourceId, CancellationToken cancellationToken)
    {
        if (!WorkIdPattern().IsMatch(sourceId ?? string.Empty))
        {
            throw new InvalidOperationException("Choose an Open Library book to add.");
        }

        var id = sourceId!.Trim();
        EnsureBookColumns();
        var workTask = GetJsonAsync($"/works/{id}.json", cancellationToken);
        var searchTask = GetJsonAsync(
            $"/search.json?q={Uri.EscapeDataString($"key:/works/{id}")}&limit=1&fields=title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,isbn,publisher,subject",
            cancellationToken);
        await Task.WhenAll(workTask, searchTask);
        var work = workTask.Result;
        var doc = FirstDoc(searchTask.Result);
        var title = Titled(Clean(work, "title", 160), doc is null ? null : Clean(doc.Value, "title", 160), Subtitle(work, doc));
        if (title is null)
        {
            throw new InvalidOperationException("Open Library did not return that book.");
        }

        var author = doc is null ? null : Join(doc.Value, "author_name", 180);
        var year = doc is { } edition ? Year(edition, "first_publish_year") ?? 0 : 0;
        var pages = doc is { } paged ? Positive(paged, "number_of_pages_median") ?? 0 : 0;
        var description = CleanDescription(work);
        var isbn = doc is null ? null : PickIsbn(doc.Value);
        var publisher = doc is null ? null : Names(doc.Value, "publisher").FirstOrDefault();
        var cover = (doc is { } covered ? CoverUrl(covered, "cover_i") : null) ?? FirstCover(work);
        var subjects = Subjects(work, doc).Take(12).ToList();
        var existing = FindBookId(id);
        var bookId = existing ?? InsertBook(title, pages, year, id);
        UpdateBook(bookId, title, pages, year, id, author, description, isbn, publisher, cover);
        SaveSubjects(bookId, subjects);
        return new { added = existing is null ? 1 : 0, id = $"book:{bookId}" };
    }

    public void EnsureBookColumns()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS Book (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                SeriesId INTEGER,
                Pages INTEGER NOT NULL,
                PartOfSeries BOOLEAN NOT NULL,
                ReleaseYear INTEGER NOT NULL,
                Read BOOLEAN NOT NULL);
            ALTER TABLE Book ADD COLUMN IF NOT EXISTS OpenLibraryId TEXT;
            ALTER TABLE Book ADD COLUMN IF NOT EXISTS Author TEXT;
            ALTER TABLE Book ADD COLUMN IF NOT EXISTS Description TEXT;
            ALTER TABLE Book ADD COLUMN IF NOT EXISTS Isbn TEXT;
            ALTER TABLE Book ADD COLUMN IF NOT EXISTS Publisher TEXT;
            ALTER TABLE Book ADD COLUMN IF NOT EXISTS CoverUrl TEXT;
            """;
        command.ExecuteNonQuery();
    }

    private static async Task<JsonElement> GetJsonAsync(string path, CancellationToken cancellationToken)
    {
        using var client = new HttpClient { BaseAddress = new Uri("https://openlibrary.org") };
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UserAgent);
        using var response = await client.GetAsync(path, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Could not reach Open Library.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return document.RootElement.Clone();
    }

    private int? FindBookId(string sourceId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM Book WHERE OpenLibraryId = @id LIMIT 1";
        command.Parameters.AddWithValue("id", sourceId);
        var value = command.ExecuteScalar();
        return value is null or DBNull ? null : Convert.ToInt32(value);
    }

    private int InsertBook(string title, int pages, int year, string sourceId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Book (Title, SeriesId, Pages, PartOfSeries, ReleaseYear, Read, OpenLibraryId)
            VALUES (@title, NULL, @pages, FALSE, @year, FALSE, @sourceId)
            RETURNING Id
            """;
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("pages", pages);
        command.Parameters.AddWithValue("year", year);
        command.Parameters.AddWithValue("sourceId", sourceId);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private void UpdateBook(
        int bookId,
        string title,
        int pages,
        int year,
        string sourceId,
        string? author,
        string? description,
        string? isbn,
        string? publisher,
        string? cover)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE Book
            SET Title = @title,
                Pages = CASE WHEN @pages > 0 THEN @pages ELSE Pages END,
                ReleaseYear = CASE WHEN @year > 0 THEN @year ELSE ReleaseYear END,
                OpenLibraryId = @sourceId,
                Author = @author,
                Description = @description,
                Isbn = @isbn,
                Publisher = @publisher,
                CoverUrl = @cover
            WHERE Id = @id
            """;
        command.Parameters.AddWithValue("id", bookId);
        command.Parameters.AddWithValue("title", title);
        command.Parameters.AddWithValue("pages", pages);
        command.Parameters.AddWithValue("year", year);
        command.Parameters.AddWithValue("sourceId", sourceId);
        command.Parameters.AddWithValue("author", (object?)author ?? DBNull.Value);
        command.Parameters.AddWithValue("description", (object?)description ?? DBNull.Value);
        command.Parameters.AddWithValue("isbn", (object?)isbn ?? DBNull.Value);
        command.Parameters.AddWithValue("publisher", (object?)publisher ?? DBNull.Value);
        command.Parameters.AddWithValue("cover", (object?)cover ?? DBNull.Value);
        command.ExecuteNonQuery();
    }

    private void SaveSubjects(int bookId, IReadOnlyList<string> subjects)
    {
        using var connection = OpenConnection();
        using (var schema = connection.CreateCommand())
        {
            schema.CommandText = """
                CREATE TABLE IF NOT EXISTS media_keyword (
                    media_kind TEXT NOT NULL,
                    media_id INTEGER NOT NULL,
                    tmdb_keyword_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    PRIMARY KEY (media_kind, media_id, tmdb_keyword_id))
                """;
            schema.ExecuteNonQuery();
        }

        using (var clear = connection.CreateCommand())
        {
            clear.CommandText = "DELETE FROM media_keyword WHERE media_kind = 'book' AND media_id = @id";
            clear.Parameters.AddWithValue("id", bookId);
            clear.ExecuteNonQuery();
        }

        foreach (var subject in subjects)
        {
            using var insert = connection.CreateCommand();
            insert.CommandText = """
                INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
                VALUES ('book', @id, @key, @name)
                ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name
                """;
            insert.Parameters.AddWithValue("id", bookId);
            insert.Parameters.AddWithValue("key", SubjectKey(subject));
            insert.Parameters.AddWithValue("name", subject);
            insert.ExecuteNonQuery();
        }
    }

    private NpgsqlConnection OpenConnection()
    {
        var connectionString = CatalogService.ResolveConnectionString(configuration);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("DATABASE_URL is not configured.");
        }

        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static JsonElement? FirstDoc(JsonElement payload)
    {
        if (!payload.TryGetProperty("docs", out var docs) || docs.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var doc in docs.EnumerateArray())
        {
            return doc;
        }

        return null;
    }

    private static bool TryWorkId(JsonElement element, string name, out string sourceId)
    {
        sourceId = string.Empty;
        if (!element.TryGetProperty(name, out var value))
        {
            return false;
        }

        var raw = value.GetString() ?? string.Empty;
        if (raw.StartsWith("/works/", StringComparison.Ordinal))
        {
            raw = raw["/works/".Length..];
        }

        if (!WorkIdPattern().IsMatch(raw))
        {
            return false;
        }

        sourceId = raw;
        return true;
    }

    private static string? Titled(string? workTitle, string? searchTitle, string? subtitle)
    {
        var title = workTitle ?? searchTitle;
        if (title is null)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(subtitle) || title.Contains(subtitle, StringComparison.OrdinalIgnoreCase))
        {
            return title;
        }

        var combined = $"{title}: {subtitle}";
        return combined.Length <= 200 ? combined : title;
    }

    private static string? Subtitle(JsonElement work, JsonElement? doc)
    {
        return Clean(work, "subtitle", 80) ?? (doc is { } edition ? Clean(edition, "subtitle", 80) : null);
    }

    private static string? CleanDescription(JsonElement work)
    {
        if (!work.TryGetProperty("description", out var description))
        {
            return null;
        }

        var text = description.ValueKind == JsonValueKind.String
            ? description.GetString()
            : description.ValueKind == JsonValueKind.Object && description.TryGetProperty("value", out var value)
                ? value.GetString()
                : null;
        text = string.Join(' ', (text ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (text.Length < 1)
        {
            return null;
        }

        return text.Length > 4000 ? text[..4000].Trim() : text;
    }

    private static IEnumerable<string> Subjects(JsonElement work, JsonElement? doc)
    {
        var names = Names(work, "subjects").Concat(doc is { } edition ? Names(edition, "subject") : []);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in names)
        {
            if (seen.Add(name))
            {
                yield return name;
            }
        }
    }

    private static string? Join(JsonElement element, string name, int max)
    {
        var names = Names(element, name).Take(4).ToArray();
        if (names.Length < 1)
        {
            return null;
        }

        var joined = string.Join(", ", names);
        return joined.Length > max ? joined[..max] : joined;
    }

    private static IEnumerable<string> Names(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }

        foreach (var item in value.EnumerateArray())
        {
            var text = item.ValueKind == JsonValueKind.String ? item.GetString() : null;
            text = string.Join(' ', (text ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            if (text.Length is > 0 and <= 80)
            {
                yield return text;
            }
        }
    }

    private static string? PickIsbn(JsonElement element)
    {
        var isbns = Names(element, "isbn").Select(isbn => new string(isbn.Where(character => char.IsDigit(character) || character is 'X' or 'x').ToArray())).ToList();
        return isbns.FirstOrDefault(isbn => isbn.Length == 13) ?? isbns.FirstOrDefault(isbn => isbn.Length == 10);
    }

    private static string? CoverUrl(JsonElement element, string name)
    {
        var id = Positive(element, name);
        return id is > 0 ? $"https://covers.openlibrary.org/b/id/{id}-M.jpg" : null;
    }

    private static string? FirstCover(JsonElement work)
    {
        if (!work.TryGetProperty("covers", out var covers) || covers.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var cover in covers.EnumerateArray())
        {
            if (cover.TryGetInt32(out var id) && id > 0)
            {
                return $"https://covers.openlibrary.org/b/id/{id}-M.jpg";
            }
        }

        return null;
    }

    private static string? Clean(JsonElement element, string name, int max)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var text = string.Join(' ', (value.GetString() ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (text.Length < 1)
        {
            return null;
        }

        return text.Length > max ? text[..max].Trim() : text;
    }

    private static int? Year(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || !value.TryGetInt32(out var year) || year is < 1 or > 3000)
        {
            return null;
        }

        return year;
    }

    private static int? Positive(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || !value.TryGetInt32(out var number) || number < 1)
        {
            return null;
        }

        return number;
    }

    private static int SubjectKey(string name)
    {
        var hash = 0u;
        foreach (var character in name.ToLowerInvariant())
        {
            hash = (hash * 33) + character;
        }

        var key = (int)(hash % 2_000_000_000);
        return key == 0 ? 1 : key;
    }

    [GeneratedRegex(@"^OL\d+W$")]
    private static partial Regex WorkIdPattern();

    [GeneratedRegex(@"horror|ghost|haunt|vampire|zombie|werewolf|witch|demon|occult|supernatural|gothic|monster|paranormal|lovecraft", RegexOptions.IgnoreCase)]
    private static partial Regex HorrorSubjectPattern();
}
