namespace HorrorTracker.Api.Catalog;

public sealed record UpcomingTitleDto(
    string Kind,
    int TmdbId,
    string Title,
    string ReleaseDate,
    int? Year,
    string? Overview,
    string? Detail);

public sealed record UpcomingScheduleDto(
    IReadOnlyList<UpcomingTitleDto> Films,
    IReadOnlyList<UpcomingTitleDto> Shows);
