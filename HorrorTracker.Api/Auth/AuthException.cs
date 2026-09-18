namespace HorrorTracker.Api.Auth;

public sealed class AuthException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
