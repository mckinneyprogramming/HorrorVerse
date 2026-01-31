using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Provides extension methods for configuring an <see cref="IHostBuilder"/> with services required to run a console
    /// application.
    /// </summary>
    /// <remarks>Use the methods in this class to register console-specific services, hosted services, and
    /// application factories when building a host for a console application. These extensions enable features such as
    /// console interaction, application lifecycle management, and dependency injection for console app
    /// components.</remarks>
    public static class HostBuilderExtensions
    {
        /// <summary>
        /// Configures the specified host builder to register services required for running a console application,
        /// including hosted services and application factories.
        /// </summary>
        /// <remarks>This method adds singleton implementations for console interaction, setup, processor,
        /// and manager factories, as well as a hosted service for application lifecycle management. Call this method
        /// during host configuration to enable console application features.</remarks>
        /// <param name="builder">The host builder to configure with console application services.</param>
        /// <returns>The same host builder instance, configured with the necessary console application services.</returns>
        public static IHostBuilder AddConsoleAppServices(this IHostBuilder builder)
        {
            return builder.ConfigureServices((context, services) =>
            {
                services.AddSingleton<IHorrorConsole, HorrorConsole>();
                services.AddSingleton<ISetupFactory>(provider =>
                    new SetupFactory(
                        Environment.GetEnvironmentVariable("HorrorVerseDb")!,
                        provider.GetRequiredService<LoggerService>(),
                        provider.GetRequiredService<IHorrorConsole>(),
                        provider.GetRequiredService<ISystemFunctions>()));

                services.AddSingleton<IProcessorFactory>(provider =>
                    new ProcessorFactory(
                        provider.GetRequiredService<LoggerService>(),
                        provider.GetRequiredService<IHorrorConsole>(),
                        provider.GetRequiredService<ISystemFunctions>()));

                services.AddSingleton<IManagerFactory>(provider =>
                    new ManagerFactory(
                        Environment.GetEnvironmentVariable("HorrorVerseDb")!,
                        provider.GetRequiredService<LoggerService>(),
                        provider.GetRequiredService<IHorrorConsole>(),
                        provider.GetRequiredService<ISystemFunctions>()));

                services.AddHostedService<HorrorVerseHostedService>();
            });
        }
    }
}