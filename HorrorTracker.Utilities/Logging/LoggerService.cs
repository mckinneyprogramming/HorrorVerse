using HorrorTracker.Utilities.Logging.Interfaces;
using Serilog;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Utilities.Logging
{
    /// <summary>
    /// The <see cref="LoggerService"/> class.
    /// </summary>
    /// <seealso cref="ILoggerService"/>
    [ExcludeFromCodeCoverage]
    public class LoggerService : ILoggerService
    {
        private readonly ILogger _logger;

        /// <summary>
        /// Uses the Serilog.Log static instance configured in HostBuilder.
        /// </summary>
        public LoggerService()
        {
            _logger = Log.Logger ?? throw new InvalidOperationException(
                "Serilog is not initialized. Make sure HostBuilder.UseSerilog() is called.");
        }

        public void CloseAndFlush()
        {
            Log.CloseAndFlush();
        }

        public void LogError(string message, Exception? exception)
        {
            if (exception != null)
            {
                _logger.Error(exception, message);
            }
            else
            {
                _logger.Error(message);
            }
        }

        public void LogInformation(string message)
        {
            _logger.Information(message);
        }

        public void LogWarning(string message)
        {
            _logger.Warning(message);
        }
    }
}