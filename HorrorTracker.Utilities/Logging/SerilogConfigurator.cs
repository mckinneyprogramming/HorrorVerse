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
        /// Configures and creates a Serilog logger with console and file sinks.
        /// Seq is added only when <c>LoggerUrl</c> is set.
        /// </summary>
        /// <param name="applicationName">The name of the application for log file naming (e.g., "horrorverse", "horrortracker").</param>
        /// <returns>The configured Serilog logger.</returns>
        public static ILogger ConfigureLogger(string applicationName = "horrorverse")
        {
            return ConfigureLogger(applicationName, LogEventLevel.Information);
        }

        /// <summary>
        /// Configures and creates a Serilog logger with custom minimum level.
        /// </summary>
        /// <param name="applicationName">The name of the application for log file naming.</param>
        /// <param name="minimumLevel">The minimum log level.</param>
        /// <returns>The configured Serilog logger.</returns>
        public static ILogger ConfigureLogger(string applicationName, LogEventLevel minimumLevel)
        {
            var logTextFileLocation = ConfigurationManager.AppSettings["LogTextFileLocation"] ?? "logs";
            Directory.CreateDirectory(logTextFileLocation);

            var configuration = new LoggerConfiguration()
                .MinimumLevel.Is(minimumLevel)
                .WriteTo.Console()
                .WriteTo.File(Path.Combine(logTextFileLocation, $"{applicationName}-.txt"), rollingInterval: RollingInterval.Day)
                .Enrich.FromLogContext();

            var loggerUrl = ResolveLoggerUrl();
            if (!string.IsNullOrWhiteSpace(loggerUrl))
            {
                configuration = configuration.WriteTo.Seq(loggerUrl);
            }

            return configuration.CreateLogger();
        }

        private static string ResolveLoggerUrl()
        {
            var fromEnvironment = Environment.GetEnvironmentVariable("LoggerUrl");
            if (!string.IsNullOrWhiteSpace(fromEnvironment))
            {
                return fromEnvironment.Trim();
            }

            return (ConfigurationManager.AppSettings["LoggerUrl"] ?? string.Empty).Trim();
        }
    }
}
