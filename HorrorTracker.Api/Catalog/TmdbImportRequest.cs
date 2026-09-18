namespace HorrorTracker.Api.Catalog;

public sealed class TmdbImportRequest
{
    public string? Kind { get; set; }
    public int TmdbId { get; set; }
}
