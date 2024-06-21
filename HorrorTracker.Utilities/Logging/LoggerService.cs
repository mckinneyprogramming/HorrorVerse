using HorrorTracker.Utilities.Logging.Interfaces;
using Serilog;
using Serilog.Core;
using System.Configuration;
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
        private readonly Logger _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="LoggerService"/> class.
        /// </summary>
        public LoggerService()
        {
#pragma warning disable CS8604 // Possible null reference argument.
            _logger = new LoggerConfiguration().WriteTo.Seq(LoggerUrl).CreateLogger();
#pragma warning restore CS8604 // Possible null reference argument.
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

        /// <summary>
        /// Retrieves the logger url from the app settings.
        /// </summary>
        private static string? LoggerUrl => ConfigurationManager.AppSettings["LoggerUrl"];
    }
}