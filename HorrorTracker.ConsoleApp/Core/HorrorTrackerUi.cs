using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.ConsoleApp.Managers;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// The <see cref="HorrorTrackerUi"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="HorrorTrackerUi"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger service.</param>
    public class HorrorTrackerUi(string? connectionString, LoggerService logger)
    {
        private readonly string? _connectionString = connectionString;
        private readonly LoggerService _logger = logger;
        private bool _isRunning = true;

        /// <summary>
        /// Runs the horror tracker console application.
        /// </summary>
        public void Run()
        {
            var coreSetup = new CoreSetup(_connectionString, _logger);
            _isRunning = coreSetup.TestDatabase();

            Console.Write("Would you like to listen to horror music (Y/N): ");
            var listenToMusic = Console.ReadLine();
            coreSetup.SetupMusic(listenToMusic);

            while (_isRunning)
            {
                Console.Clear();
                var coreMenuSetup = new CoreMenuSetup(coreSetup.SetupHorrorConnections(), _logger);
                coreMenuSetup.DisplayMainMenu();
                var decision = Console.ReadLine();
                var actions = MainMenuDecisionActions();

                ConsoleHelper.ProcessDecision(decision, _logger, actions);
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
                { 1, () => new MovieDatabaseApiManager(_logger, _connectionString).Manage() },
                { 2, () => new ManualManager(_connectionString, _logger).Manage() },
                { 3, MovieDatabaseApiManager.DisplayUpcomingHorrorFilms },
                { 4, () => new AccountManager(_logger).Manage() },
                { 5, () => { _isRunning = false; _logger.LogInformation("Selected to exit."); } }
            };
        }
    }
}