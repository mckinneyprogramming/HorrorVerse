using HorrorTracker.Api.Logging;
using Microsoft.Extensions.Logging;

namespace HorrorTracker.Tests.Logging;

public class MicrosoftLoggerAdapterTests
{
    [Fact]
    public void ForwardsEachLevelAndClose()
    {
        using var factory = LoggerFactory.Create(builder => builder.SetMinimumLevel(LogLevel.Trace));
        var adapter = new MicrosoftLoggerAdapter(factory.CreateLogger<MicrosoftLoggerAdapter>());

        adapter.LogInformation("opened");
        adapter.LogWarning("careful");
        adapter.LogError("failed", new InvalidOperationException("down"));
        adapter.CloseAndFlush();
    }
}
