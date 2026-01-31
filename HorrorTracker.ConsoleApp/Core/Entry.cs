using HorrorTracker.Utilities.HostBuilder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Spectre.Console;
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
        /// <summary>
        /// Serves as the entry point for the application.
        /// </summary>
        /// <remarks>
        /// This method initializes required services and components, then starts the main
        /// program logic. It is typically called automatically when the application is launched.
        /// </remarks>
        static async Task Main(string[] args)
        {
            AnsiConsole.MarkupLine("[bold red]Initializing HorrorVerse...[/]");

            using IHost host = HostBuilderFactory
                .CreateBaseHostBuilder(args)
                .AddConsoleAppServices()
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