namespace HorrorTracker.Api.Catalog;

public sealed record FranchiseDto(int Id, string Name, IReadOnlyList<string> Items);
