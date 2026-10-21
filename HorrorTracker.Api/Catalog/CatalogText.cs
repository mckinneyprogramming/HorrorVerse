using System.Text.Json;

namespace HorrorTracker.Api.Catalog;

internal static class CatalogText
{
    public static string? Clean(JsonElement element, string name, int max)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var text = string.Join(' ', value.GetString()!.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (text.Length < 1)
        {
            return null;
        }

        return text.Length > max ? text[..max].Trim() : text;
    }
}
