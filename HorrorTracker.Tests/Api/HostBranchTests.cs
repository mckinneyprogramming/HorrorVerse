using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HorrorTracker.Tests.Api;

public class HostBranchTests
{
    [Fact]
    public async Task Host_CoversMissingStaticFilesAndBlankWebRoot()
    {
        if (!CoverageSupport.Ready(out _))
        {
            return;
        }

        var directory = Directory.CreateTempSubdirectory("horrorverse-empty").FullName;
        var missingDirectory = Path.Combine(Path.GetTempPath(), "horrorverse-missing-" + Guid.NewGuid().ToString("N"));
        try
        {
            using (var empty = new BranchApplication { WebRoot = directory })
            using (var client = empty.CreateClient())
            {
                Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/not-the-app")).StatusCode);
            }

            using (var absent = new BranchApplication { WebRoot = missingDirectory })
            using (var client = absent.CreateClient())
            {
                Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health")).StatusCode);
            }

            using (var blank = new BranchApplication { WebRoot = " " })
            using (var client = blank.CreateClient())
            {
                Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health")).StatusCode);
            }

            var content = Directory.CreateTempSubdirectory("horrorverse-content").FullName;
            try
            {
                using var contentHost = new BranchApplication { ContentRoot = content };
                using var contentClient = contentHost.CreateClient();
                Assert.Equal(HttpStatusCode.OK, (await contentClient.GetAsync("/api/health")).StatusCode);
            }
            finally
            {
                if (Directory.Exists(content))
                {
                    Directory.Delete(content, true);
                }
            }
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
        }
    }

    private sealed class BranchApplication : WebApplicationFactory<Program>
    {
        public string? WebRoot { get; init; }

        public string? ContentRoot { get; init; }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            if (ContentRoot is not null)
            {
                builder.UseContentRoot(ContentRoot);
            }

            if (WebRoot is not null)
            {
                builder.UseSetting(WebHostDefaults.WebRootKey, WebRoot);
            }

            builder.UseSetting("UseForwardedHeaders", "false");
            builder.UseSetting("ForceHttpsRedirection", "false");
        }
    }
}
