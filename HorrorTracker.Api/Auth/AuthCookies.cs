namespace HorrorTracker.Api.Auth;

internal static class AuthCookies
{
    public const string Name = "hv_session";

    public static string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out var token) ? token : null;

    public static void Set(HttpContext http, string token)
    {
        http.Response.Cookies.Append(Name, token, CreateOptions(http, DateTimeOffset.UtcNow.AddDays(30)));
    }

    public static void Clear(HttpContext http)
    {
        http.Response.Cookies.Append(Name, string.Empty, CreateOptions(http, DateTimeOffset.UnixEpoch));
    }

    private static CookieOptions CreateOptions(HttpContext http, DateTimeOffset expires) => new()
    {
        HttpOnly = true,
        Secure = http.Request.IsHttps,
        SameSite = SameSiteMode.Lax,
        Path = "/",
        Expires = expires
    };
}
