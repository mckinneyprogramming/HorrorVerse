using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data;
using HorrorTracker.Data.Audio;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// The <see cref="CoreSetup"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="CoreSetup"/> class.
    /// </remarks>
    /// <param name="databaseConnection">The database connection.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class CoreSetup(DatabaseConnection databaseConnection, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        private readonly DatabaseConnection _databaseConnection = databaseConnection;
        private readonly LoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <summary>
        /// Creates the horror connections.
        /// </summary>
        /// <returns>The horror connections.</returns>
        public HorrorConnections SetupHorrorConnections()
        {
            return new HorrorConnections(_databaseConnection, _logger);
        }

        /// <summary>
        /// Sets up the music player based on the users decision.
        /// </summary>
        /// <param name="listenToMusic">The users decision.</param>
        public void SetupMusic(string? listenToMusic)
        {
            if (string.Equals(listenToMusic, "y", StringComparison.CurrentCultureIgnoreCase) ||
                string.Equals(listenToMusic, "yes", StringComparison.CurrentCultureIgnoreCase))
            {
                _logger.LogInformation("User has opted in for music.");
                _horrorConsole.SetForegroundColor(ConsoleColor.DarkGray);
                _horrorConsole.MarkupLine("You have opted in for music!");
                var musicPlayer = new MusicPlayer(_logger);
                musicPlayer.LoadAndShuffleSongs();
                musicPlayer.StartPlaying();
                _systemFunctions.Sleep(2000);
            }
            else
            {
                _logger.LogInformation("User has opted out of music.");
                _horrorConsole.SetForegroundColor(ConsoleColor.DarkGray);
                _horrorConsole.MarkupLine("You have opted out of music.");
                _systemFunctions.Sleep(3000);
            }
        }

        /// <summary>
        /// Tests the connection to the database.
        /// </summary>
        /// <returns>True or false.</returns>
        public bool TestDatabaseConnection()
        {
            var connections = SetupHorrorConnections();
            var themersFactory = new ThemersFactory(_horrorConsole, _systemFunctions);

            _logger.LogInformation("Testing the Postgre database server and connection to the HorrorTracker database.");
            _horrorConsole.SetForegroundColor(ConsoleColor.DarkGray);
            _horrorConsole.MarkupLine("We are testing the connection to the database. Please standby.");
            _horrorConsole.ResetColor();
            _horrorConsole.WriteLine();
            themersFactory.SpookyTextStyler.ThinkingAnimation("Testing", 10, "Testing Complete!");
            _horrorConsole.WriteLine();

            try
            {
                var connectionMessage = connections.Connect();
                if (connectionMessage.Contains("successful!"))
                {
                    _ = connections.CreateTables();
                    _horrorConsole.SetForegroundColor(ConsoleColor.Green);
                    _horrorConsole.MarkupLine(connectionMessage);
                    _horrorConsole.ResetColor();
                    _horrorConsole.WriteLine();
                    themersFactory.SpookyTextStyler.ThinkingAnimation("Directing to Main Menu", 10, "Have fun!");
                    _systemFunctions.Sleep(3000);
                    return true;
                }
                else
                {
                    _horrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                    _horrorConsole.MarkupLine(connectionMessage);
                    _horrorConsole.ResetColor();
                    _horrorConsole.WriteLine();
                    themersFactory.SpookyTextStyler.ThinkingAnimation("Exiting Horror Tracker", 10, "Goodbye!");
                    _systemFunctions.Sleep(3000);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Connection failed: {ex.Message}", ex);
                _horrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                _horrorConsole.MarkupLine("An error occurred while connecting to the database. Please check the logs for details. Returning to main menu...");
                _horrorConsole.ResetColor();
                _horrorConsole.WriteLine();
                return false;
            }
        }
    }
}