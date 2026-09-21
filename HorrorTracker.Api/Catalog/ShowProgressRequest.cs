namespace HorrorTracker.Api.Catalog;

public sealed class ShowProgressRequest
{
    public string? Id { get; set; }
    public int? Season { get; set; }
    public int? SeasonId { get; set; }
    public int? EpisodeId { get; set; }
    public bool Completed { get; set; }
}
