namespace HorrorTracker.Api.Library;

public sealed class ListWriteRequest
{
    public int? Id { get; set; }
    public int? ListId { get; set; }
    public string? Name { get; set; }
    public string? ItemId { get; set; }
    public int? FranchiseId { get; set; }
    public string? Visibility { get; set; }
}
