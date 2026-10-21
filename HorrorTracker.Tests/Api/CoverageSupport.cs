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
