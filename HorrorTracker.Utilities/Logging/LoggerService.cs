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
        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="LoggerService"/> class.
        /// </summary>
        public LoggerService()
        {
            _logger = new LoggerConfiguration().WriteTo.Seq("http://localhost:5341").CreateLogger();
        }

        /// <inheritdoc/>
        public void CloseAndFlush()
        {
            Log.CloseAndFlush();
        }

        /// <inheritdoc/>
        public void LogError(string message, Exception exception)
        {
            _logger.Error(message, exception);
        }

        /// <inheritdoc/>
        public void LogInformation(string message)
        {
            _logger.Information(message);
        }

        /// <inheritdoc/>
        public void LogWarning(string message)
        {
            _logger.Warning(message);
        }
    }
}