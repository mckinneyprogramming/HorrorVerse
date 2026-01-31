using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging;
using Microsoft.Extensions.Hosting;
using System.Configuration;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Handles application startup configuration, dependency initialization, and environment validation.
    /// </summary>
    public class HorrorVerseHostedService(
        IHostApplicationLifetime hostLifetime,
        IHorrorConsole console,
        ISystemFunctions systemFunctions,
        LoggerService loggerService,
        ISetupFactory setupFactory,
        IProcessorFactory processorFactory,
        IManagerFactory managerFactory) : BackgroundService
    {
        private readonly IHorrorConsole _horrorConsole = console;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;
        private readonly LoggerService _loggerService = loggerService;

        private readonly ISetupFactory _setupFactory = setupFactory;
        private readonly IProcessorFactory _processorFactory = processorFactory;
        private readonly IManagerFactory _managerFactory = managerFactory;
        private readonly IHostApplicationLifetime _hostLifetime = hostLifetime;

        /// <summary>
        /// Initializes all required services and starts the main application.
        /// </summary>
        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var logFolder = ConfigurationManager.AppSettings["LogTextFileLocation"] ?? "logs";
            _ = Directory.CreateDirectory(logFolder);
            _loggerService.LogInformation($"HorrorVerse logs are being written to: {logFolder}");

            _horrorConsole.MarkupLine("[gray]Loading configuration...[/]");

            _loggerService.LogInformation("Starting HorrorVerse bootstrap process...");
            _loggerService.LogInformation("Starting HorrorVerse host...");

            try
            {
                var connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb");
                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    _horrorConsole.MarkupLine("[bold red]Error:[/] Database connection string is not set.\n" +
                        "Please check or set the 'HorrorVerseDb' environment variable.");
                    _loggerService.LogError("Startup aborted: Missing database connection string.", null);
                    throw new InvalidOperationException("Missing 'HorrorVerseDb' environment variable.");
                }

                _horrorConsole.MarkupLine("[green]Configuration loaded successfully![/]");
                _horrorConsole.MarkupLine("[gray]Setting up core systems...[/]");
                _systemFunctions.Sleep(2000);

                _loggerService.LogInformation("Dependencies initialized successfully.");

                // Inject factories into Program
                var program = new Program(
                    _loggerService,
                    _horrorConsole,
                    _systemFunctions,
                    _setupFactory,
                    _processorFactory,
                    _managerFactory)
                {
                    OnExit = _hostLifetime.StopApplication
                };

                program.Main();
            }
            catch (Exception ex)
            {
                _loggerService.LogError("A critical error occurred during startup.", ex);
                _horrorConsole.MarkupLine("[bold red]A critical error occurred during startup.[/]");
            }
            finally
            {
                _loggerService.LogInformation("HorrorVerse host shutting down.");
            }

            return Task.CompletedTask;
        }
    }
}