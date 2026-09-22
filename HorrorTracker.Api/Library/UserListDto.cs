namespace HorrorTracker.Api.Library;

public sealed record UserListDto(int Id, string Name, IReadOnlyList<string> Items, string Visibility = "private");
