using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Logging;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Utilities.Logging.Interfaces;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

var connectionString = CatalogService.ResolveConnectionString(builder.Configuration);
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Set the HorrorVerseDb environment variable or ConnectionStrings:HorrorVerse so the API can reach PostgreSQL.");
}

builder.Services.AddSingleton<ILoggerService, MicrosoftLoggerAdapter>();
builder.Services.AddScoped<IDatabaseConnection>(_ => new DatabaseConnection(connectionString));
builder.Services.AddScoped<MovieRepository>();
builder.Services.AddScoped<MovieSeriesRepository>();
builder.Services.AddScoped<DocumentaryRepository>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<AuthService>();

var app = builder.Build();

if (app.Configuration.GetValue("UseForwardedHeaders", !app.Environment.IsDevelopment()))
{
    var forwarded = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
    };
    forwarded.KnownIPNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
}

if (app.Configuration.GetValue("ForceHttpsRedirection", false))
{
    app.UseHttpsRedirection();
}

var webRoot = app.Environment.WebRootPath;
var hasSpa = !string.IsNullOrWhiteSpace(webRoot)
    && Directory.Exists(webRoot)
    && File.Exists(Path.Combine(webRoot, "index.html"));

if (hasSpa)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/catalog", (CatalogService catalog) => catalog.GetAll());
app.MapGet("/api/catalog/{kind}", (string kind, CatalogService catalog) => catalog.GetByKind(kind));
app.MapPost("/api/catalog", (CatalogWriteRequest body, HttpContext http, AuthService auth, CatalogService catalog) =>
    WriteCatalog(http, auth, () => Results.Json(catalog.Create(body))));
app.MapPatch("/api/catalog", (CatalogWriteRequest body, HttpContext http, AuthService auth, CatalogService catalog) =>
    WriteCatalog(http, auth, () => Results.Json(catalog.Update(body))));
app.MapDelete("/api/catalog", (string? id, HttpContext http, AuthService auth, CatalogService catalog) =>
    WriteCatalog(http, auth, () =>
    {
        catalog.Delete(id);
        return Results.Json(new { ok = true });
    }));
app.MapGet("/api/auth", (HttpContext http, AuthService auth) =>
{
    return Results.Json(new { user = auth.GetCurrent(AuthCookies.Read(http.Request)) });
});
app.MapPost("/api/auth", (AuthRequest body, HttpContext http, AuthService auth) =>
{
    try
    {
        var action = body.Action?.Trim();
        var session = string.Equals(action, "register", StringComparison.OrdinalIgnoreCase)
            ? auth.Register(body)
            : auth.Login(body);
        AuthCookies.Set(http, session.Token);
        return Results.Json(new { user = session.User });
    }
    catch (AuthException exception)
    {
        return Results.Json(new { error = exception.Message }, statusCode: exception.StatusCode);
    }
});
app.MapDelete("/api/auth", (HttpContext http, AuthService auth) =>
{
    auth.Logout(AuthCookies.Read(http.Request));
    AuthCookies.Clear(http);
    return Results.Json(new { user = (AuthUserDto?)null });
});

if (hasSpa)
{
    app.MapFallbackToFile("index.html");
}

app.Run();

static IResult WriteCatalog(HttpContext http, AuthService auth, Func<IResult> write)
{
    try
    {
        auth.RequireAdmin(AuthCookies.Read(http.Request));
        return write();
    }
    catch (AuthException exception)
    {
        return Results.Json(new { error = exception.Message }, statusCode: exception.StatusCode);
    }
    catch (InvalidOperationException exception)
    {
        return Results.Json(new { error = exception.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
}
