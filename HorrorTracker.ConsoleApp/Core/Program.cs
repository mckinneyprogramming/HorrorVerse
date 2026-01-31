using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Provides the entry point and main workflow orchestration for the HorrorVerse application, including startup
    /// initialization, user interface activation, and application shutdown procedures.
    /// </summary>
    /// <remarks>The Program class is responsible for coordinating the startup sequence, managing the main
    /// user interface session, and ensuring proper cleanup on exit. It should be instantiated once per application run
    /// and is not thread-safe. All dependencies must be provided via constructor injection.</remarks>
    /// <param name="logger">The logging service used to record informational, warning, and error messages throughout the application's
    /// lifecycle. Cannot be null.</param>
    /// <param name="horrorConsole">The console abstraction used for themed output, user interaction, and display management. Cannot be null.</param>
    /// <param name="systemFunctions">Provides access to system-level operations required by the application, such as environment queries and process
    /// control. Cannot be null.</param>
    /// <param name="setupFactory">A factory for creating setup-related components and services used during application initialization. Cannot be
    /// null.</param>
    /// <param name="processorFactory">A factory for creating processor components that handle core application logic and user commands. Cannot be
    /// null.</param>
    /// <param name="managerFactory">A factory for creating manager components responsible for coordinating application subsystems and resources.
    /// Cannot be null.</param>
    [ExcludeFromCodeCoverage]
    public class Program(
        ILoggerService logger,
        IHorrorConsole horrorConsole,
        ISystemFunctions systemFunctions,
        ISetupFactory setupFactory,
        IProcessorFactory processorFactory,
        IManagerFactory managerFactory)
    {
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        private readonly ISetupFactory _setupFactory = setupFactory;
        private readonly IProcessorFactory _processorFactory = processorFactory;
        private readonly IManagerFactory _managerFactory = managerFactory;

        /// <summary>
        /// Gets or sets the action to execute when an exit event occurs.
        /// </summary>
        /// <remarks>Assign a delegate to this property to specify custom logic that should run when the
        /// exit event is triggered. If the property is null, no action will be performed on exit.</remarks>
        public Action? OnExit { get; set; }

        /// <summary>
        /// Initializes and starts the application, handling startup logging, execution, and cleanup operations.
        /// </summary>
        /// <remarks>This method logs the application startup, executes the main application logic, and
        /// ensures cleanup is performed regardless of success or failure. Any unexpected exceptions encountered during
        /// execution are logged for diagnostic purposes.</remarks>
        public void Main()
        {
            _logger.LogInformation("HorrorVerse has started.");
            _horrorConsole.MarkupLine("[bold green]HorrorVerse started successfully![/]");

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

            HorrorVerseUi horrorVerseUi = new(_logger, _horrorConsole, _setupFactory, _processorFactory, _managerFactory);
            horrorVerseUi.Run(() => OnExit?.Invoke());
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

            _horrorConsole.SetForegroundColor(ConsoleColor.Green);
            _horrorConsole.Write("Thank you for visiting HorrorVerse! Come back for more scares soon!");
            Thread.Sleep(2000);

            _horrorConsole.ResetColor();
            _horrorConsole.Clear();
        }
    }
}