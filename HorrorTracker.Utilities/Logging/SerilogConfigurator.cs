using Serilog;
using Serilog.Events;
using System.Configuration;

namespace HorrorTracker.Utilities.Logging
{
    /// <summary>
    /// Provides centralized Serilog configuration for Horror Tracker applications.
    /// </summary>
    public static class SerilogConfigurator
    {
        /// <summary>
        /// Configures and creates a Serilog logger with file and Seq sinks.
        /// </summary>
        /// <param name="applicationName">The name of the application for log file naming (e.g., "horrorverse", "horrortracker").</param>
        /// <returns>The configured Serilog logger.</returns>
        public static ILogger ConfigureLogger(string applicationName = "horrorverse")
        {
            var backupLoggerUrl = ConfigurationManager.AppSettings["LoggerUrl"] ?? string.Empty;
            var logTextFileLocation = ConfigurationManager.AppSettings["LogTextFileLocation"] ?? "logs";

            Directory.CreateDirectory(logTextFileLocation);

            return new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.File(Path.Combine(logTextFileLocation, $"{applicationName}-.txt"), rollingInterval: RollingInterval.Day)
                .WriteTo.Seq(Environment.GetEnvironmentVariable("LoggerUrl") ?? backupLoggerUrl)
                .Enrich.FromLogContext()
                .CreateLogger();
        }

        /// <summary>
        /// Configures and creates a Serilog logger with custom minimum level.
        /// </summary>
        /// <param name="applicationName">The name of the application for log file naming.</param>
        /// <param name="minimumLevel">The minimum log level.</param>
        /// <returns>The configured Serilog logger.</returns>
        public static ILogger ConfigureLogger(string applicationName, LogEventLevel minimumLevel)
        {
            var backupLoggerUrl = ConfigurationManager.AppSettings["LoggerUrl"] ?? string.Empty;
            var logTextFileLocation = ConfigurationManager.AppSettings["LogTextFileLocation"] ?? "logs";

            Directory.CreateDirectory(logTextFileLocation);

            return new LoggerConfiguration()
                .MinimumLevel.Is(minimumLevel)
                .WriteTo.File(Path.Combine(logTextFileLocation, $"{applicationName}-.txt"), rollingInterval: RollingInterval.Day)
                .WriteTo.Seq(Environment.GetEnvironmentVariable("LoggerUrl") ?? backupLoggerUrl)
                .Enrich.FromLogContext()
                .CreateLogger();
        }
    }
}