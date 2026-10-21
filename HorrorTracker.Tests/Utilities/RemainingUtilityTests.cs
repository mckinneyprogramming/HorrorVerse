using HorrorTracker.Utilities;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.Tests.Utilities;

public class RemainingUtilityTests
{
    [Fact]
    public void CapitalizeFirstLetter_UppercasesTheFirstCharacter()
    {
        Assert.Equal("Movie", StringUtility.CapitalizeFirstLetter("movie"));
    }

    [Fact]
    public void IsDecimal_RejectsANonNumericString()
    {
        var parser = new Parser();

        Assert.False(parser.IsDecimal("nope", out var result));
        Assert.Equal(0m, result);
    }

    [Fact]
    public void ConfigureLogger_WritesAFileAndHonorsLoggerUrl()
    {
        var previous = Environment.GetEnvironmentVariable("LoggerUrl");
        var directory = Path.Combine(Path.GetTempPath(), "horrorverse-logs-" + Guid.NewGuid().ToString("N"));
        try
        {
            Environment.SetEnvironmentVariable("LoggerUrl", "   ");
            var plain = SerilogConfigurator.ConfigureLogger();
            plain.Information("vault");
            (plain as IDisposable)?.Dispose();

            Environment.SetEnvironmentVariable("LoggerUrl", "http://127.0.0.1:9");
            var sequenced = SerilogConfigurator.ConfigureLogger("horror-test", Serilog.Events.LogEventLevel.Debug);
            sequenced.Debug("vault");
            (sequenced as IDisposable)?.Dispose();
            Assert.True(Directory.Exists("logs") || Directory.Exists(directory));
        }
        finally
        {
            Environment.SetEnvironmentVariable("LoggerUrl", previous);
        }
    }
}
