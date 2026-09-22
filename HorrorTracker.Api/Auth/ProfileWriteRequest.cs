namespace HorrorTracker.Api.Auth;

public sealed class ProfileWriteRequest
{
    public string? DisplayName { get; set; }
    public string? AboutMe { get; set; }
    public string? Avatar { get; set; }
}
