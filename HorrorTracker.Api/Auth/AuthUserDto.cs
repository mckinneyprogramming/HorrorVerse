namespace HorrorTracker.Api.Auth;

public sealed record AuthUserDto(
    int Id,
    string Email,
    string DisplayName,
    bool IsAdmin,
    string? AboutMe = null,
    string? Avatar = null);
