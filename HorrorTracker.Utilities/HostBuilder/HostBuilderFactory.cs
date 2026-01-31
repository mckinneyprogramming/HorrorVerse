using HorrorTracker.Utilities.Helpers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using System.Configuration;

namespace HorrorTracker.Utilities.HostBuilder
{
    /// <summary>
    /// The <see cref="HostBuilderFactory"/> class.
    /// </summary>
    public static class HostBuilderFactory
    {
        /// <summary>
        /// Creates the base host builder with common services and logging configuration.
        /// </summary>
        /// <param name="args">The list of arguments.</param>
        /// <returns>The host builder.</returns>
        public static IHostBuilder CreateBaseHostBuilder(string[] args)
        {
            var backupLoggerUrl = ConfigurationManager.AppSettings["LoggerUrl"] ?? string.Empty;
            var logTextFileLocation = ConfigurationManager.AppSettings["LogTextFileLocation"] ?? "logs";

            Directory.CreateDirectory(logTextFileLocation);

            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.File(Path.Combine(logTextFileLocation, "horrorverse-.txt"), rollingInterval: RollingInterval.Day)
                .WriteTo.Seq(Environment.GetEnvironmentVariable("LoggerUrl") ?? backupLoggerUrl)
                .Enrich.FromLogContext()
                .CreateLogger();

            return Host.CreateDefaultBuilder(args ?? [])
                .UseSerilog()
                .ConfigureServices((context, services) =>
                {
                    services.AddSingleton<LoggerService>();
                    services.AddSingleton<ISystemFunctions, SystemFunctions>();
                });
        }
    }
}