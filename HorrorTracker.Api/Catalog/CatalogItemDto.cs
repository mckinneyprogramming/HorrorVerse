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
    string? SeriesTitle = null,
    int? TotalEpisodes = null,
    int? NumberOfSeasons = null,
    IReadOnlyList<string>? Keywords = null,
    string? PosterPath = null,
    int? Pages = null,
    string? Author = null,
    string? Description = null,
    string? CoverUrl = null,
    string? Isbn = null,
    string? Publisher = null);
