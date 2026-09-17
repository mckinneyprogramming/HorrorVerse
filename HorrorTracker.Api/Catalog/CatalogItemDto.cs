namespace HorrorTracker.Api.Catalog;

public sealed record CatalogItemDto(string Id, int MediaId, string Title, string Kind, bool Completed);
