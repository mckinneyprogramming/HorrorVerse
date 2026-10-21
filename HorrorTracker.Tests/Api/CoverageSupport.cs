using System.Net.Http.Headers;
using System.Text;
using HorrorTracker.Api.Catalog;
using Npgsql;

namespace HorrorTracker.Tests.Api;

internal static class CoverageSupport
{
    public static bool Ready(out string connectionString)
    {
        connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb") ?? string.Empty;
        return connectionString.Contains("Username=horror", StringComparison.OrdinalIgnoreCase)
            && connectionString.Contains("Password=horror", StringComparison.Ordinal);
    }

    public static async Task EnsureVault(string connectionString)
    {
        await Exec(connectionString, """
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
            ALTER TABLE Movie ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            CREATE TABLE IF NOT EXISTS MovieSeries (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                TotalTime NUMERIC NOT NULL DEFAULT 0,
                TotalMovies INTEGER NOT NULL DEFAULT 0,
                Watched BOOLEAN NOT NULL DEFAULT FALSE,
                PosterPath TEXT
            );
            ALTER TABLE MovieSeries ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            CREATE TABLE IF NOT EXISTS Documentary (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                TotalTime NUMERIC NOT NULL DEFAULT 0,
                ReleaseYear INTEGER NOT NULL DEFAULT 0,
                Watched BOOLEAN NOT NULL DEFAULT FALSE,
                PosterPath TEXT
            );
            ALTER TABLE Documentary ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            CREATE TABLE IF NOT EXISTS Show (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                TotalTime DECIMAL(10, 2) NOT NULL,
                TotalEpisodes INTEGER NOT NULL,
                NumberOfSeasons INTEGER NOT NULL,
                Watched BOOLEAN NOT NULL);
            ALTER TABLE Show ADD COLUMN IF NOT EXISTS TmdbId INTEGER;
            ALTER TABLE Show ADD COLUMN IF NOT EXISTS ReleaseYear INTEGER;
            ALTER TABLE Show ADD COLUMN IF NOT EXISTS PosterPath TEXT;
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
            CREATE TABLE IF NOT EXISTS Game (
                Id SERIAL PRIMARY KEY,
                Title TEXT NOT NULL,
                ReleaseYear INTEGER NOT NULL,
                Played BOOLEAN NOT NULL);
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS IgdbId INTEGER;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Description TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS CoverUrl TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Developer TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Publisher TEXT;
            ALTER TABLE Game ADD COLUMN IF NOT EXISTS Platforms TEXT;
            CREATE TABLE IF NOT EXISTS franchise (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS franchise_name_idx ON franchise (lower(name));
            CREATE TABLE IF NOT EXISTS app_user (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            ALTER TABLE app_user ADD COLUMN IF NOT EXISTS about_me TEXT;
            ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar TEXT;
            CREATE TABLE IF NOT EXISTS franchise_item (
                franchise_id INTEGER NOT NULL REFERENCES franchise(id) ON DELETE CASCADE,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (franchise_id, media_kind, media_id)
            );
            CREATE TABLE IF NOT EXISTS user_media_progress (
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, media_kind, media_id)
            );
            CREATE TABLE IF NOT EXISTS user_list (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS user_list_user_id_idx ON user_list (user_id);
            CREATE UNIQUE INDEX IF NOT EXISTS user_list_user_name_idx ON user_list (user_id, lower(name));
            CREATE TABLE IF NOT EXISTS user_list_item (
                list_id INTEGER NOT NULL REFERENCES user_list(id) ON DELETE CASCADE,
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (list_id, media_kind, media_id)
            );
            CREATE TABLE IF NOT EXISTS user_progress_seed (
                user_id INTEGER PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
                seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS show_season (
                id SERIAL PRIMARY KEY,
                show_id INTEGER NOT NULL,
                season_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                UNIQUE (show_id, season_number));
            CREATE TABLE IF NOT EXISTS show_episode (
                id SERIAL PRIMARY KEY,
                show_id INTEGER NOT NULL,
                season_id INTEGER NOT NULL,
                episode_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                runtime DECIMAL(10, 2) NOT NULL DEFAULT 0,
                air_date DATE,
                UNIQUE (season_id, episode_number));
            CREATE TABLE IF NOT EXISTS user_episode_progress (
                user_id INTEGER NOT NULL,
                episode_id INTEGER NOT NULL,
                completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, episode_id));
            CREATE TABLE IF NOT EXISTS media_keyword (
                media_kind TEXT NOT NULL,
                media_id INTEGER NOT NULL,
                tmdb_keyword_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                PRIMARY KEY (media_kind, media_id, tmdb_keyword_id));
            CREATE INDEX IF NOT EXISTS media_keyword_name_idx ON media_keyword (lower(name));
            CREATE TABLE IF NOT EXISTS catalog_sync (
                id INTEGER PRIMARY KEY,
                last_synced_at TIMESTAMPTZ NOT NULL);
            """);
    }

    public static async Task Exec(string connectionString, string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }

    public static async Task<T> Scalar<T>(string connectionString, string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        var value = await command.ExecuteScalarAsync();
        return (T)Convert.ChangeType(value, typeof(T))!;
    }

    public static void ClearStaticCache(Type type)
    {
        var cache = type.GetField("Cache", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!.GetValue(null)!;
        cache.GetType().GetMethod("Clear")!.Invoke(cache, null);
    }

    public static void ExpireCache(Type type, object key)
    {
        var cache = type.GetField("Cache", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!.GetValue(null)!;
        var dictionary = (System.Collections.IDictionary)cache;
        if (!dictionary.Contains(key))
        {
            return;
        }

        var entry = dictionary[key]!;
        var expires = entry.GetType().GetField("<Expires>k__BackingField", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
        expires!.SetValue(entry, DateTimeOffset.UtcNow.AddHours(-8));
    }

    public static void SetIgdbToken(string? token, DateTimeOffset expires)
    {
        var type = typeof(IgdbCatalogService);
        var flags = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static;
        type.GetField("CachedToken", flags)!.SetValue(null, token);
        type.GetField("CachedTokenExpires", flags)!.SetValue(null, expires);
    }

    public static HttpResponseMessage Json(string body, System.Net.HttpStatusCode status = System.Net.HttpStatusCode.OK)
    {
        return new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
    }

    public static HttpResponseMessage Bytes(byte[] body, string? mediaType)
    {
        var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(body),
        };
        if (mediaType is not null)
        {
            response.Content.Headers.ContentType = new MediaTypeHeaderValue(mediaType);
        }

        return response;
    }
}
