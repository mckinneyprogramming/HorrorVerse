using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Spectre.Console;
using System.Configuration;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Provides the entry point for the application.
    /// </summary>
    /// <remarks>
    /// The Main method initializes essential services and components before starting the main
    /// program logic. It is typically invoked automatically when the application is launched.
    /// </remarks>
    [ExcludeFromCodeCoverage]
    static class Entry
    {
        private static readonly string BackUpLoggerUrl = ConfigurationManager.AppSettings["LoggerUrl"] ?? string.Empty;
        private static readonly string LogTextFileLocation = ConfigurationManager.AppSettings["LogTextFileLocation"] ?? "logs";

        /// <summary>
        /// Serves as the entry point for the application.
        /// </summary>
        /// <remarks>
        /// This method initializes required services and components, then starts the main
        /// program logic. It is typically called automatically when the application is launched.
        /// </remarks>
        static async Task Main()
        {
            AnsiConsole.MarkupLine("[bold red]Initializing HorrorVerse...[/]");

            _ = Directory.CreateDirectory(LogTextFileLocation);
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.File(Path.Combine(LogTextFileLocation, "horrorverse-.txt"), rollingInterval: RollingInterval.Day)
                .WriteTo.Seq(Environment.GetEnvironmentVariable("LoggerUrl") ?? BackUpLoggerUrl)
                .Enrich.FromLogContext()
                .CreateLogger();

            using IHost host = Host.CreateDefaultBuilder()
                .UseSerilog()
                .ConfigureServices((context, services) =>
                {
                    services.AddSingleton<IHorrorConsole, HorrorConsole>();
                    services.AddSingleton<ISystemFunctions, SystemFunctions>();
                    services.AddSingleton<LoggerService>();

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
                })
                .Build();

            var lifetime = host.Services.GetRequiredService<IHostApplicationLifetime>();

            _ = host.RunAsync();

            var completionSource = new TaskCompletionSource();
            lifetime.ApplicationStopped.Register(completionSource.SetResult);

            await completionSource.Task;
            await Log.CloseAndFlushAsync();
        }
    }
}