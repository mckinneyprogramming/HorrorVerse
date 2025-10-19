using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Core
{
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

        public Action? OnExit { get; set; }

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
            _horrorConsole.Write("Thank you for visiting HorrorVerse! Come back for more scares soon!\n");
            Thread.Sleep(2000);

            _horrorConsole.ResetColor();
            _horrorConsole.Clear();
        }
    }
}