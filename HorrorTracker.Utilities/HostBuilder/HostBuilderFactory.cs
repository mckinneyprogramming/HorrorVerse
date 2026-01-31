using HorrorTracker.Utilities.Helpers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;

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
            Log.Logger = SerilogConfigurator.ConfigureLogger("horrorverse");

            return Host.CreateDefaultBuilder(args)
                .UseSerilog()
                .ConfigureServices((context, services) =>
                {
                    services.AddSingleton<LoggerService>();
                    services.AddSingleton<ISystemFunctions, SystemFunctions>();
                });
        }
    }
}