using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;

namespace HorrorTracker.Tests.Api;

public class ApiHostTests : IDisposable
{
    private readonly string? _previousConnection = Environment.GetEnvironmentVariable("HorrorVerseDb");
    private readonly List<string> _directories = [];

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("HorrorVerseDb", _previousConnection);
        foreach (var directory in _directories)
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
        }
    }

    [Fact]
    public void Host_RequiresAConnectionString()
    {
        Environment.SetEnvironmentVariable("HorrorVerseDb", null);
        using var factory = new HorrorApplication();

        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("HorrorVerseDb", exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task HealthAndUnsignedRoutes_DoNotNeedADatabase()
    {
        Environment.SetEnvironmentVariable("HorrorVerseDb", "Host=localhost;Username=horror;Password=horror;Database=HorrorTracker");
        using var factory = new HorrorApplication();
        using var client = factory.CreateClient();

        var health = await client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);

        var auth = await client.GetFromJsonAsync<AuthPayload>("/api/auth");
        Assert.Null(auth!.User);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/progress")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/lists")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/friends")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/shows")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/watch")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/tmdb")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/sync")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync("/api/catalog")).StatusCode);

        var logout = await client.DeleteAsync("/api/auth");
        Assert.Equal(HttpStatusCode.OK, logout.StatusCode);
    }

    [Fact]
    public async Task Host_CoversForwardedHeadersHttpsAndStaticFiles()
    {
        Environment.SetEnvironmentVariable("HorrorVerseDb", "Host=localhost;Username=horror;Password=horror;Database=HorrorTracker");
        var webRoot = Directory.CreateTempSubdirectory("horrorverse-wwwroot").FullName;
        _directories.Add(webRoot);
        await File.WriteAllTextAsync(Path.Combine(webRoot, "index.html"), "<!doctype html><title>HorrorVerse</title>");

        using var factory = new HorrorApplication
        {
            WebRoot = webRoot,
            ForceHttps = true,
            Forwarded = true,
        };
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var health = await client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);

        var page = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
    }

    private sealed class AuthPayload
    {
        public object? User { get; set; }
    }

    private sealed class HorrorApplication : WebApplicationFactory<Program>
    {
        public string? WebRoot { get; init; }
        public bool ForceHttps { get; init; }
        public bool Forwarded { get; init; }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            if (WebRoot is not null)
            {
                builder.UseWebRoot(WebRoot);
            }

            builder.UseSetting("ForceHttpsRedirection", ForceHttps ? "true" : "false");
            builder.UseSetting("UseForwardedHeaders", Forwarded ? "true" : "false");
        }
    }
}
