using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Handles application startup configuration, dependency initialization, and environment validation.
    /// </summary>
    public static class Bootstrapper
    {
        /// <summary>
        /// Initializes all required services and starts the main application.
        /// </summary>
        public static void Start()
        {
            var logger = new LoggerService();
            var horrorConsole = new HorrorConsole();
            var systemFunctions = new SystemFunctions();

            horrorConsole.MarkupLine("[bold red]Initializing HorrorVerse...[/]");
            logger.LogInformation("Starting HorrorVerse bootstrap process...");

            try
            {
                horrorConsole.MarkupLine("[gray]Loading configuration...[/]");
                var connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb");

                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    horrorConsole.SetForegroundColor(ConsoleColor.Red);
                    horrorConsole.MarkupLine("[bold red]Error:[/] Database connection string is not set.\n" +
                        "Please check or set the 'HorrorVerseDb' environment variable.");
                    return;
                }

                horrorConsole.MarkupLine("[green]Configuration loaded successfully![/]");
                horrorConsole.MarkupLine("[gray]Setting up core systems...[/]");
                systemFunctions.Sleep(2000);
                logger.LogInformation("Dependencies initialized successfully.");

                var program = new Program(connectionString, logger, horrorConsole, systemFunctions);
                program.Main();
            }
            catch (Exception ex)
            {
                logger.LogError("Startup aborted: Missing database connection string.", ex);
                horrorConsole.MarkupLine("[bold red]A critical error occurred during startup.[/]");
            }
            finally
            {
                logger.LogInformation("Bootstrapper finished initialization.");
            }
        }
    }
}