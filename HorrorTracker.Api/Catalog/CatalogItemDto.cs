namespace HorrorTracker.Api.Catalog;

public sealed record CatalogItemDto(
    string Id,
    int MediaId,
    string Title,
    string Kind,
    bool Completed,
    decimal? TotalTime = null,
    int? ReleaseYear = null,
    int? SeriesId = null,
    string? SeriesTitle = null);
