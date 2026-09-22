using HorrorTracker.Api.Auth;
using HorrorTracker.Api.Catalog;
using HorrorTracker.Api.Library;
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
builder.Services.AddScoped<ShowGuideService>();
builder.Services.AddScoped<KeywordCatalogService>();
builder.Services.AddScoped<WatchCatalogService>();
builder.Services.AddScoped<FranchiseCatalogService>();
builder.Services.AddScoped<TmdbCatalogService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserLibraryService>();

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
app.MapDelete("/api/catalog", (string? id, HttpContext http, AuthService auth, CatalogService catalog, UserLibraryService library, FranchiseCatalogService franchises, ShowGuideService shows) =>
    WriteCatalog(http, auth, () =>
    {
        shows.PurgeShow(id);
        catalog.Delete(id);
        library.PurgeMedia(id);
        franchises.PurgeMedia(id);
        return Results.Json(new { ok = true });
    }));
app.MapGet("/api/franchises", (FranchiseCatalogService franchises) => Results.Json(new { franchises = franchises.GetAll() }));
app.MapPost("/api/franchises", (FranchiseWriteRequest body, HttpContext http, AuthService auth, FranchiseCatalogService franchises) =>
    WriteCatalog(http, auth, () =>
        Results.Json(new
        {
            franchises = string.IsNullOrWhiteSpace(body.ItemId)
                ? franchises.Create(body)
                : franchises.AddItem(body)
        })));
app.MapPatch("/api/franchises", (FranchiseWriteRequest body, HttpContext http, AuthService auth, FranchiseCatalogService franchises) =>
    WriteCatalog(http, auth, () => Results.Json(new { franchises = franchises.Rename(body) })));
app.MapDelete("/api/franchises", (int? id, int? franchiseId, string? itemId, HttpContext http, AuthService auth, FranchiseCatalogService franchises) =>
    WriteCatalog(http, auth, () =>
        Results.Json(new
        {
            franchises = string.IsNullOrWhiteSpace(itemId)
                ? franchises.Delete(id)
                : franchises.RemoveItem(franchiseId ?? id, itemId)
        })));
app.MapGet("/api/shows", async (string? id, int? season, HttpContext http, AuthService auth, ShowGuideService shows) =>
    await WriteSignedInUserAsync(http, auth, user => shows.GetGuideAsync(user, id, season, http.RequestAborted)));
app.MapPatch("/api/shows", async (ShowProgressRequest body, HttpContext http, AuthService auth, ShowGuideService shows) =>
    await WriteSignedInUserAsync(http, auth, user => shows.SetProgressAsync(user, body, http.RequestAborted)));
app.MapGet("/api/watch", async (string? id, HttpContext http, AuthService auth, WatchCatalogService watch) =>
    await WriteSignedInAsync(http, auth, async () => Results.Json(await watch.GetAsync(id, http.RequestAborted))));
app.MapGet("/api/tmdb", async (string? kind, string? q, HttpContext http, AuthService auth, TmdbCatalogService tmdb) =>
    await WriteSignedInAsync(http, auth, async () => Results.Json(await tmdb.SearchAsync(kind, q, http.RequestAborted))));
app.MapPost("/api/tmdb", async (TmdbImportRequest body, HttpContext http, AuthService auth, TmdbCatalogService tmdb) =>
    await WriteSignedInAsync(http, auth, async () => Results.Json(await tmdb.ImportAsync(body, http.RequestAborted))));
app.MapGet("/api/sync", async (string? id, HttpContext http, AuthService auth, TmdbCatalogService tmdb) =>
    await WriteCatalogSyncAsync(http, auth, (force) => tmdb.SyncAsync(id, force, http.RequestAborted)));
app.MapGet("/api/progress", (HttpContext http, AuthService auth, UserLibraryService library) =>
    WriteSignedIn(http, auth, user => Results.Json(new { ids = library.GetCompletedIds(user) })));
app.MapPatch("/api/progress", (ProgressWriteRequest body, HttpContext http, AuthService auth, UserLibraryService library) =>
    WriteSignedIn(http, auth, user => Results.Json(new { ids = library.SetCompleted(user, body) })));
app.MapGet("/api/lists", (HttpContext http, AuthService auth, UserLibraryService library) =>
    WriteSignedIn(http, auth, user => Results.Json(new { lists = library.GetLists(user) })));
app.MapPost("/api/lists", (ListWriteRequest body, HttpContext http, AuthService auth, UserLibraryService library) =>
    WriteSignedIn(http, auth, user =>
        Results.Json(new
        {
            lists = body.FranchiseId is > 0
                ? library.AddFranchise(user, body)
                : string.IsNullOrWhiteSpace(body.ItemId)
                    ? library.CreateList(user, body)
                    : library.AddListItem(user, body)
        })));
app.MapPatch("/api/lists", (ListWriteRequest body, HttpContext http, AuthService auth, UserLibraryService library) =>
    WriteSignedIn(http, auth, user => Results.Json(new { lists = library.RenameList(user, body) })));
app.MapDelete("/api/lists", (int? id, int? listId, int? franchiseId, string? itemId, HttpContext http, AuthService auth, UserLibraryService library) =>
    WriteSignedIn(http, auth, user =>
        Results.Json(new
        {
            lists = franchiseId is > 0
                ? library.RemoveFranchise(user, listId ?? id, franchiseId)
                : string.IsNullOrWhiteSpace(itemId)
                    ? library.DeleteList(user, id)
                    : library.RemoveListItem(user, listId ?? id, itemId)
        })));
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

static IResult WriteSignedIn(HttpContext http, AuthService auth, Func<AuthUserDto, IResult> write)
{
    try
    {
        return write(auth.RequireUser(AuthCookies.Read(http.Request)));
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

static async Task<IResult> WriteSignedInAsync(HttpContext http, AuthService auth, Func<Task<IResult>> write)
{
    try
    {
        auth.RequireUser(AuthCookies.Read(http.Request));
        return await write();
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

static async Task<IResult> WriteCatalogSyncAsync(HttpContext http, AuthService auth, Func<bool, Task<object>> write)
{
    try
    {
        var cron = IsTrustedCron(http);
        AuthUserDto? user = null;
        if (!cron)
        {
            user = auth.RequireUser(AuthCookies.Read(http.Request));
        }

        return Results.Json(await write(cron || user?.IsAdmin == true));
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

static bool IsTrustedCron(HttpContext http)
{
    var secret = Environment.GetEnvironmentVariable("CRON_SECRET");
    var authorization = http.Request.Headers.Authorization.ToString();
    if (!string.IsNullOrWhiteSpace(secret))
    {
        return string.Equals(authorization, $"Bearer {secret}", StringComparison.Ordinal);
    }

    return string.Equals(http.Request.Headers["x-vercel-cron"].ToString(), "1", StringComparison.Ordinal);
}

static async Task<IResult> WriteSignedInUserAsync(HttpContext http, AuthService auth, Func<AuthUserDto, Task<object>> write)
{
    try
    {
        var user = auth.RequireUser(AuthCookies.Read(http.Request));
        return Results.Json(await write(user));
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
