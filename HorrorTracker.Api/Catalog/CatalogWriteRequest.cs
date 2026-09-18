namespace HorrorTracker.Api.Catalog;

public sealed class CatalogWriteRequest
{
    public string? Id { get; set; }
    public string? Title { get; set; }
    public string? Kind { get; set; }
    public bool Completed { get; set; }
    public int? ReleaseYear { get; set; }
    public decimal? TotalTime { get; set; }
    public int? Pages { get; set; }
    public int? TotalEpisodes { get; set; }
    public int? NumberOfSeasons { get; set; }
    public int? TotalMovies { get; set; }
}
