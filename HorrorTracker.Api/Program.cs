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

if (hasSpa)
{
    app.MapFallbackToFile("index.html");
}

app.Run();
