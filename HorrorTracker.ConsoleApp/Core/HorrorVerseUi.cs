using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Provides the user interface and entry point for the HorrorVerse console application, enabling users to interact
    /// with horror-related features such as movie databases, manuals, music, and account management.
    /// </summary>
    /// <remarks>This class coordinates the initialization and main menu flow of the HorrorVerse application.
    /// It relies on the provided services to manage user interactions, database connectivity, and system-level
    /// operations. The application remains active until the user chooses to exit from the main menu.</remarks>
    /// <param name="logger">The logger service used to record informational messages, warnings, and errors throughout the application's
    /// execution.</param>
    /// <param name="horrorConsole">The console interface used for user input and output operations within the application.</param>
    /// <param name="setupFactory">The setup factory.</param>
    /// <param name="processorFactory">The processor factory.</param>
    /// <param name="managerFactory">The manager factory.</param>
    public class HorrorVerseUi(
        ILoggerService logger,
        IHorrorConsole horrorConsole,
        ISetupFactory setupFactory,
        IProcessorFactory processorFactory,
        IManagerFactory managerFactory)
    {
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISetupFactory _setupFactory = setupFactory;
        private readonly IProcessorFactory _processorFactory = processorFactory;
        private readonly IManagerFactory _managerFactory = managerFactory;

        private const string MusicPrompt = "Would you like to listen to horror music (Y/N): ";

        /// <summary>
        /// Initializes and runs the main application loop, setting up core components and handling user interaction
        /// through the console.
        /// </summary>
        /// <remarks>This method establishes a database connection, configures music and horror-related
        /// features, and repeatedly displays the main menu to process user decisions until the application is no longer
        /// running. It should be called once to start the application's interactive session.</remarks>
        public void Run()
        {
            bool isRunning;
            var coreSetup = _setupFactory.CreateCoreSetup();
            isRunning = coreSetup.TestDatabaseConnection();

            _horrorConsole.WriteLine();
            _horrorConsole.Write(MusicPrompt);
            var listenToMusic = _horrorConsole.ReadLine();
            coreSetup.SetupMusic(listenToMusic);
            _horrorConsole.Clear();

            var coreMenuSetup = _setupFactory.CreateCoreMenuSetup(coreSetup);
            coreMenuSetup.DisplayHorrorVerseIntro();

            var actions = MainMenuDecisionActions(() => isRunning = false);

            while (isRunning)
            {
                var decision = coreMenuSetup.DisplayMainMenu();
                var decisionProcessor = _processorFactory.CreateDecisionProcessor();
                decisionProcessor.Process(decision, actions);
                _horrorConsole.Clear();
            }
        }

        /// <summary>
        /// Creates a mapping of main menu decision identifiers to their corresponding actions.
        /// </summary>
        /// <remarks>The returned dictionary associates menu choices with their respective management or
        /// display operations. Selecting the exit option will terminate the application's main loop and log the action.
        /// The caller can use this mapping to invoke the appropriate functionality based on user input.</remarks>
        /// <returns>A dictionary where each key is an integer representing a main menu option, and each value is an action to
        /// execute when that option is selected.</returns>
        private Dictionary<int, Action> MainMenuDecisionActions(Action exitAction)
        {
            var movieDatabaseApiManager = _managerFactory.CreateMovieDatabaseApiManager();

            return new()
            {
                [1] = movieDatabaseApiManager.Manage,
                [2] = _managerFactory.CreateManualManager().Manage,
                [3] = movieDatabaseApiManager.DisplayUpcomingHorrorFilms,
                [4] = _managerFactory.CreateAccountManager().Manage,
                [5] = () =>
                {
                    _logger.LogInformation("Selected to exit.");
                    exitAction();
                }
            };
        }
    }
}