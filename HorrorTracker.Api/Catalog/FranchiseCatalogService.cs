using Npgsql;

namespace HorrorTracker.Api.Catalog;

public sealed class FranchiseCatalogService(IConfiguration configuration)
{
    private static readonly HashSet<string> AllowedKinds = ["movie", "series", "show", "book", "game"];

    public IReadOnlyList<FranchiseDto> GetAll()
    {
        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT f.id, f.name, i.media_kind, i.media_id
            FROM franchise f
            LEFT JOIN franchise_item i ON i.franchise_id = f.id
            ORDER BY lower(f.name), f.id, i.added_at, i.media_kind, i.media_id
            """;

        var franchises = new List<FranchiseDto>();
        var indexById = new Dictionary<int, int>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var id = reader.GetInt32(0);
            if (!indexById.TryGetValue(id, out var index))
            {
                index = franchises.Count;
                indexById[id] = index;
                franchises.Add(new FranchiseDto(id, reader.GetString(1), []));
            }

            if (reader.IsDBNull(2) || reader.IsDBNull(3))
            {
                continue;
            }

            var items = franchises[index].Items.ToList();
            items.Add($"{reader.GetString(2)}:{reader.GetInt32(3)}");
            franchises[index] = franchises[index] with { Items = items };
        }

        return franchises;
    }

    public IReadOnlyList<FranchiseDto> Create(FranchiseWriteRequest request)
    {
        EnsureSchema();
        EnsureFranchiseLimit();
        var name = NormalizeName(request.Name);

        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "INSERT INTO franchise (name) VALUES (@name)";
            command.Parameters.AddWithValue("name", name);
            command.ExecuteNonQuery();
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            throw new InvalidOperationException("A franchise with that name already exists.");
        }

        return GetAll();
    }

    public IReadOnlyList<FranchiseDto> Rename(FranchiseWriteRequest request)
    {
        EnsureSchema();
        var id = RequireFranchiseId(request.Id ?? request.FranchiseId);
        var name = NormalizeName(request.Name);

        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "UPDATE franchise SET name = @name WHERE id = @id";
            command.Parameters.AddWithValue("name", name);
            command.Parameters.AddWithValue("id", id);
            if (command.ExecuteNonQuery() < 1)
            {
                throw new InvalidOperationException("That franchise was not found.");
            }
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            throw new InvalidOperationException("A franchise with that name already exists.");
        }

        return GetAll();
    }

    public IReadOnlyList<FranchiseDto> Delete(int? id)
    {
        EnsureSchema();
        var franchiseId = RequireFranchiseId(id);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM franchise WHERE id = @id";
        command.Parameters.AddWithValue("id", franchiseId);
        if (command.ExecuteNonQuery() < 1)
        {
            throw new InvalidOperationException("That franchise was not found.");
        }

        return GetAll();
    }

    public IReadOnlyList<FranchiseDto> AddItem(FranchiseWriteRequest request)
    {
        EnsureSchema();
        var franchiseId = RequireExisting(request.FranchiseId ?? request.Id);
        var (kind, mediaId) = ParseCatalogId(request.ItemId);
        EnsureItemLimit(franchiseId);

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO franchise_item (franchise_id, media_kind, media_id)
            VALUES (@franchiseId, @kind, @mediaId)
            ON CONFLICT (franchise_id, media_kind, media_id) DO NOTHING
            """;
        command.Parameters.AddWithValue("franchiseId", franchiseId);
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("mediaId", mediaId);
        command.ExecuteNonQuery();
        if (kind == "series")
        {
            AddSeriesMovies(franchiseId, mediaId);
        }

        return GetAll();
    }

    public IReadOnlyList<FranchiseDto> RemoveItem(int? franchiseId, string? itemId)
    {
        EnsureSchema();
        var id = RequireExisting(franchiseId);
        var (kind, mediaId) = ParseCatalogId(itemId);

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM franchise_item
            WHERE franchise_id = @franchiseId AND media_kind = @kind AND media_id = @mediaId
            """;
        command.Parameters.AddWithValue("franchiseId", id);
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("mediaId", mediaId);
        command.ExecuteNonQuery();
        if (kind == "series")
        {
            RemoveSeriesMovies(id, mediaId);
        }

        return GetAll();
    }

    public void PurgeMedia(string? id)
    {
        try
        {
            var (kind, mediaId) = ParseCatalogId(id);
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM franchise_item WHERE media_kind = @kind AND media_id = @mediaId";
            command.Parameters.AddWithValue("kind", kind);
            command.Parameters.AddWithValue("mediaId", mediaId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Franchise tables are created on first catalog read.
        }
        catch (InvalidOperationException)
        {
            // Unknown catalog kinds have nothing to purge.
        }
    }

    public void AddMovieToFranchisesContainingSeries(int seriesId, int movieId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO franchise_item (franchise_id, media_kind, media_id)
                SELECT franchise_id, 'movie', @movieId
                FROM franchise_item
                WHERE media_kind = 'series' AND media_id = @seriesId
                ON CONFLICT (franchise_id, media_kind, media_id) DO NOTHING
                """;
            command.Parameters.AddWithValue("movieId", movieId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Franchise tables may not exist yet.
        }
    }

    private void AddSeriesMovies(int franchiseId, int seriesId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO franchise_item (franchise_id, media_kind, media_id)
                SELECT @franchiseId, 'movie', id
                FROM movie
                WHERE seriesid = @seriesId
                ON CONFLICT DO NOTHING
                """;
            command.Parameters.AddWithValue("franchiseId", franchiseId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void RemoveSeriesMovies(int franchiseId, int seriesId)
    {
        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                DELETE FROM franchise_item
                WHERE franchise_id = @franchiseId
                  AND media_kind = 'movie'
                  AND media_id IN (SELECT id FROM movie WHERE seriesid = @seriesId)
                """;
            command.Parameters.AddWithValue("franchiseId", franchiseId);
            command.Parameters.AddWithValue("seriesId", seriesId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException)
        {
            // Movie table or series links may not be available.
        }
    }

    private void EnsureSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS franchise (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS franchise_name_idx ON franchise (lower(name));
            CREATE TABLE IF NOT EXISTS franchise_item (
                franchise_id INTEGER NOT NULL REFERENCES franchise(id) ON DELETE CASCADE,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (franchise_id, media_kind, media_id)
            );
            """;
        command.ExecuteNonQuery();
    }

    private int RequireExisting(int? id)
    {
        var franchiseId = RequireFranchiseId(id);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM franchise WHERE id = @id";
        command.Parameters.AddWithValue("id", franchiseId);
        if (command.ExecuteScalar() is null)
        {
            throw new InvalidOperationException("That franchise was not found.");
        }

        return franchiseId;
    }

    private void EnsureFranchiseLimit()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM franchise";
        if (Convert.ToInt64(command.ExecuteScalar()) >= 80)
        {
            throw new InvalidOperationException("The vault already has 80 franchises.");
        }
    }

    private void EnsureItemLimit(int franchiseId) =>
        CatalogDb.EnsureCountAtMost(
            configuration,
            "SELECT COUNT(*) FROM franchise_item WHERE franchise_id = @id",
            franchiseId,
            200,
            "That franchise is full.");

    private NpgsqlConnection OpenConnection() => CatalogDb.Open(configuration);

    private static (string Kind, int MediaId) ParseCatalogId(string? id) =>
        CatalogDb.ParseCatalogId(
            id,
            AllowedKinds,
            "That title was not found.",
            "Franchises can hold series, movies, shows, and books.");

    private static int RequireFranchiseId(int? id)
    {
        if (id is null or < 1)
        {
            throw new InvalidOperationException("That franchise was not found.");
        }

        return id.Value;
    }

    private static string NormalizeName(string? name)
    {
        var value = (name ?? string.Empty).Trim();
        if (value.Length is < 1 or > 80)
        {
            throw new InvalidOperationException("Enter a franchise name.");
        }

        return value;
    }
}
