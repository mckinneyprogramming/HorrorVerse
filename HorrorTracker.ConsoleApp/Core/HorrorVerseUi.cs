using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.ConsoleApp.Managers;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.ConsoleApp.Interfaces;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// The <see cref="HorrorVerseUi"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="HorrorVerseUi"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="horrorConsole">The horror console.</param>
    public class HorrorVerseUi(string? connectionString, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        private readonly string? _connectionString = connectionString;
        private readonly LoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;
        private bool _isRunning = true;

        /// <summary>
        /// Runs the horror tracker console application.
        /// </summary>
        public async Task Run()
        {
            DatabaseConnection databaseConnection = new(_connectionString);
            CoreSetup coreSetup = new(databaseConnection, _logger, _horrorConsole, _systemFunctions);
            _isRunning = coreSetup.TestDatabaseConnection();

            _horrorConsole.WriteLine();
            _horrorConsole.Write("Would you like to listen to horror music (Y/N): ");
            var listenToMusic = _horrorConsole.ReadLine();
            coreSetup.SetupMusic(listenToMusic);
            _horrorConsole.Clear();

            var coreMenuSetup = new CoreMenuSetup(coreSetup.SetupHorrorConnections(), _logger, _horrorConsole, _systemFunctions);
            await coreMenuSetup.DisplayHorrorVerseIntro();

            while (_isRunning)
            {
                coreMenuSetup.DisplayMainMenu();
                var decision = _horrorConsole.ReadLine();
                var actions = MainMenuDecisionActions();

                ConsoleHelper.ProcessDecision(decision, _logger, actions);
                _horrorConsole.Clear();
            }
        }

        /// <summary>
        /// Retrieves the main menu decision actions.
        /// </summary>
        /// <returns>The dictionary of actions.</returns>
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