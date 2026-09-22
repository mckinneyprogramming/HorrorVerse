namespace HorrorTracker.Api.Catalog;

public sealed class FranchiseWriteRequest
{
    public int? Id { get; set; }
    public int? FranchiseId { get; set; }
    public string? Name { get; set; }
    public string? ItemId { get; set; }
}
