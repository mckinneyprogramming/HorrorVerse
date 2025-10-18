using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data;
using HorrorTracker.Data.Audio;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Utilities.Logging.Interfaces;

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
            var wantsMusic = IsAffirmative(listenToMusic);
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

        /// <summary>
        /// Determines whether the given input is an affirmative response.
        /// </summary>
        private static bool IsAffirmative(string? input) =>
            input?.Trim().ToLowerInvariant() switch
            {
                "y" or "yes" or "yeah" or "yep" or "sure" or "ok" => true,
                _ => false
            };
    }
}