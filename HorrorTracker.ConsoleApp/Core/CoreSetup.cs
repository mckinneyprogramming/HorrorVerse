using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data;
using HorrorTracker.Data.Audio;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Utilities.Helpers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Provides core setup functionality for initializing horror-themed application components, including database
    /// connections, logging, console interactions, and system utilities.
    /// </summary>
    /// <remarks>Use this class to configure and initialize essential services required for the application's
    /// startup and runtime operations. All dependencies must be provided and valid to ensure correct setup and
    /// functionality.</remarks>
    /// <param name="databaseConnection">The database connection to be used for accessing and managing application data.</param>
    /// <param name="logger">The logger service for recording informational and error messages throughout the application's lifecycle.</param>
    /// <param name="horrorConsole">The console interface for displaying output and interacting with the user in a themed manner.</param>
    /// <param name="systemFunctions">The system functions provider for performing operations such as sleeping or other system-level tasks.</param>
    public class CoreSetup(
        DatabaseConnection databaseConnection,
        ILoggerService logger,
        IHorrorConsole horrorConsole,
        ISystemFunctions systemFunctions)
    {
        private readonly DatabaseConnection _databaseConnection = databaseConnection;
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <summary>
        /// Initializes and returns a new instance of the HorrorConnections class configured with the current database
        /// connection and logger.
        /// </summary>
        /// <returns>A HorrorConnections object that uses the existing database connection and logger for horror-related operations.</returns>
        public HorrorConnections SetupHorrorConnections()
        {
            return new HorrorConnections(_databaseConnection, _logger);
        }

        /// <summary>
        /// Configures music playback based on the user's preference input.
        /// </summary>
        /// <remarks>This method logs the user's choice and provides console feedback. If music is
        /// enabled, songs are loaded, shuffled, and playback begins. The method introduces a brief delay after
        /// processing the user's selection.</remarks>
        /// <param name="listenToMusic">A string indicating whether the user wants to listen to music. Accepts affirmative values such as "yes" or
        /// "y" to enable music; otherwise, music will be disabled. Can be null.</param>
        public void SetupMusic(string? listenToMusic)
        {
            var wantsMusic = StringHelper.IsAffirmative(listenToMusic);
            var wantsMusicString = wantsMusic ? "in" : "out";

            _logger.LogInformation($"User has opted {wantsMusicString} of music.");
            _horrorConsole.SetForegroundColor(ConsoleColor.DarkGray);
            _horrorConsole.MarkupLine($"You have opted {wantsMusicString} for music.");

            if (wantsMusic)
            {
                var musicPlayer = new MusicPlayer(_logger);
                musicPlayer.LoadAndShuffleSongs();
                musicPlayer.StartPlaying();
                _systemFunctions.Sleep(2000);
            }
            else
            {
                _systemFunctions.Sleep(3000);
            }
        }

        /// <summary>
        /// Tests the connection to the PostgreSQL database server and verifies access to the HorrorTracker database.
        /// </summary>
        /// <remarks>This method attempts to establish a connection to the database and create required
        /// tables if the connection is successful. If the connection fails or an error occurs, the method logs the
        /// error and returns false. The method provides console feedback during the process.</remarks>
        /// <returns>true if the connection to the database is successful; otherwise, false.</returns>
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