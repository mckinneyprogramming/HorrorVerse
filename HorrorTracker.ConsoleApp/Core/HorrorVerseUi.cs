using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Managers;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Parsing;
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
    /// <param name="connectionString">The connection string used to establish a database connection for application data storage and retrieval. Can be
    /// null if database features are not required.</param>
    /// <param name="logger">The logger service used to record informational messages, warnings, and errors throughout the application's
    /// execution.</param>
    /// <param name="horrorConsole">The console interface used for user input and output operations within the application.</param>
    /// <param name="systemFunctions">The system functions provider used to access platform-specific operations required by the application.</param>
    public class HorrorVerseUi(string connectionString, ILoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        private readonly string _connectionString = connectionString;
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;
        private bool _isRunning;

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
            DatabaseConnection databaseConnection = new(_connectionString);
            CoreSetup coreSetup = new(databaseConnection, _logger, _horrorConsole, _systemFunctions);
            _isRunning = coreSetup.TestDatabaseConnection();

            _horrorConsole.WriteLine();
            _horrorConsole.Write(MusicPrompt);
            var listenToMusic = _horrorConsole.ReadLine();
            coreSetup.SetupMusic(listenToMusic);
            _horrorConsole.Clear();

            var coreMenuSetup = new CoreMenuSetup(coreSetup.SetupHorrorConnections(), _horrorConsole, _systemFunctions);
            coreMenuSetup.DisplayHorrorVerseIntro();

            while (_isRunning)
            {
                var decision = coreMenuSetup.DisplayMainMenu();
                var decisionProcessor = new DecisionProcessor(new Parser(), _logger, _horrorConsole, _systemFunctions);
                decisionProcessor.Process(decision, MainMenuDecisionActions());
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
        private Dictionary<int, Action> MainMenuDecisionActions()
        {
            return new Dictionary<int, Action>
            {
                { 1, () => new MovieDatabaseApiManager(_logger, _connectionString, _horrorConsole, _systemFunctions).Manage() },
                { 2, () => new ManualManager(_connectionString, _logger, _horrorConsole, _systemFunctions).Manage() },
                { 3, () => new MovieDatabaseApiManager(_logger, _connectionString, _horrorConsole, _systemFunctions).DisplayUpcomingHorrorFilms() },
                { 4, () => new AccountManager(_logger, _horrorConsole, _systemFunctions).Manage() },
                { 5, () => { _isRunning = false; _logger.LogInformation("Selected to exit."); } }
            };
        }
    }
}