using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Api.Logging;

internal sealed class MicrosoftLoggerAdapter(ILogger<MicrosoftLoggerAdapter> logger) : ILoggerService
{
    public void CloseAndFlush()
    {
    }

    public void LogError(string message, Exception exception)
    {
        logger.LogError(exception, "{Message}", message);
    }

    public void LogInformation(string message)
    {
        logger.LogInformation("{Message}", message);
    }

    public void LogWarning(string message)
    {
        logger.LogWarning("{Message}", message);
    }
}
