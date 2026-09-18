namespace HorrorTracker.Api.Auth;

public sealed class AuthRequest
{
    public string? Action { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? DisplayName { get; set; }
}
