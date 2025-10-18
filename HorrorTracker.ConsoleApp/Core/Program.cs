using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Represents the entry point and lifecycle management for the HorrorTracker application, coordinating startup,
    /// execution, and shutdown processes.
    /// </summary>
    /// <remarks>
    /// This class should be instantiated once to manage the application's lifecycle, including
    /// initialization, user interface activation, error handling, and resource cleanup. It coordinates dependencies
    /// such as logging, console interaction, and system utilities to ensure a consistent and reliable application
    /// experience.
    /// </remarks>
    /// <param name="connectionString">
    /// The database connection string used to initialize application data sources.
    /// Can be null if no database is required.
    /// </param>
    /// <param name="logger">
    /// The logging service used to record informational messages, errors, and application events throughout the application's lifecycle.
    /// </param>
    /// <param name="horrorConsole">
    /// The console interface responsible for user interaction, display output, and themed presentation within the application.
    /// </param>
    /// <param name="systemFunctions">
    /// Provides access to system-level operations and utilities required by the application for environment setup and control.
    /// </param>
    [ExcludeFromCodeCoverage]
    public class Program(string connectionString, LoggerService logger, HorrorConsole horrorConsole, SystemFunctions systemFunctions)
    {
        private readonly LoggerService _logger = logger;
        private readonly HorrorConsole _horrorConsole = horrorConsole;
        private readonly SystemFunctions _systemFunctions = systemFunctions;

        private readonly ISetupFactory setupFactory = new SetupFactory(connectionString, logger, horrorConsole, systemFunctions);
        private readonly IProcessorFactory processorFactory = new ProcessorFactory(logger, horrorConsole, systemFunctions);
        private readonly IManagerFactory managerFactory = new ManagerFactory(connectionString, logger, horrorConsole, systemFunctions);

        /// <summary>
        /// Starts the application, handling initialization, execution, and cleanup. Logs startup and any unexpected
        /// errors encountered during execution.
        /// </summary>
        /// <remarks>
        /// This method should be called once to begin the application's lifecycle. It ensures
        /// that resources are properly cleaned up even if an error occurs during execution. Any exceptions thrown by
        /// the application are logged for diagnostic purposes.
        /// </remarks>
        public void Main()
        {
            _logger.LogInformation("HorrorVerse has started.");

            try
            {
                RunApplication();
            }
            catch (Exception ex)
            {
                _logger.LogError("An unexpected error occurred.", ex);
            }
            finally
            {
                Cleanup();
            }
        }

        /// <summary>
        /// Initializes and runs the main application workflow, including startup presentation and user interface
        /// activation.
        /// </summary>
        /// <remarks>
        /// This method sets up the console environment, displays a themed startup sequence, and launches 
        /// the primary user interface. It should be called once to begin the application's interactive session.
        /// </remarks>
        private void RunApplication()
        {
            Console.Title = ConsoleStrings.Title("Home");

            var themersFactory = new ThemersFactory(_horrorConsole, _systemFunctions);
            var spookyStartupGenerator = new SpookyStartupGenerator(themersFactory, _horrorConsole, _systemFunctions);
            spookyStartupGenerator.Startup();
            _horrorConsole.Markup(ConsoleStrings.PressAnyKey("continue"));
            _horrorConsole.ReadKey(true);
            _horrorConsole.Clear();

            HorrorVerseUi horrorVerseUi = new(_logger, _horrorConsole, setupFactory, processorFactory, managerFactory);
            horrorVerseUi.Run();
        }

        /// <summary>
        /// Performs final cleanup operations, including logging shutdown information, resetting console colors, and
        /// prompting the user before application exit.
        /// </summary>
        /// <remarks>
        /// This method should be called when the application is ready to terminate to ensure
        /// that logging resources are properly released and the console state is restored. It waits for user input
        /// before closing, allowing users to review any final messages.
        /// </remarks>
        private void Cleanup()
        {
            _logger.LogInformation("HorrorVerse has ended.");
            _logger.CloseAndFlush();

            _horrorConsole.ResetColor();
            _horrorConsole.Write(ConsoleStrings.PressAnyKey("exit"));
            _ = Console.ReadKey();
        }
    }
}