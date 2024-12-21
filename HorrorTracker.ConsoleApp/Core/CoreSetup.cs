using HorrorTracker.ConsoleApp.ConsoleHelpers;
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
    public class CoreSetup(DatabaseConnection databaseConnection, LoggerService logger)
    {
        private readonly DatabaseConnection _databaseConnection = databaseConnection;
        private readonly LoggerService _logger = logger;

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
                var musicPlayer = new MusicPlayer(_logger);
                musicPlayer.LoadAndShuffleSongs();
                musicPlayer.StartPlaying();
            }
            else
            {
                _logger.LogInformation("User has opted out of music.");
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.WriteLine("You have opted out of music.");
            }
        }

        /// <summary>
        /// Tests the connection to the database.
        /// </summary>
        /// <returns>True or false.</returns>
        public bool TestDatabaseConnection()
        {
            var connections = SetupHorrorConnections();
            _logger.LogInformation("Testing the Postgre database server and connection to the HorrorTracker database.");
            ConsoleHelper.ColorWriteLineWithReset("We are testing the connection to the database. Please standby.", ConsoleColor.DarkGray);
            Console.WriteLine();
            ConsoleHelper.ThinkingAnimation("Testing", 10, "Testing Complete!");
            Console.WriteLine();

            try
            {
                var connectionMessage = connections.Connect();
                if (connectionMessage.Contains("successful!"))
                {
                    _ = connections.CreateTables();
                    ConsoleHelper.ColorWriteLineWithReset(connectionMessage, ConsoleColor.Green);
                    Console.WriteLine();
                    ConsoleHelper.ThinkingAnimation("Directing to Main Menu", 10, "Have fun!");
                    Thread.Sleep(3000);
                    return true;
                }
                else
                {
                    ConsoleHelper.ColorWriteLineWithReset(connectionMessage, ConsoleColor.DarkRed);
                    Console.WriteLine();
                    ConsoleHelper.ThinkingAnimation("Exiting Horror Tracker", 10, "Goodbye!");
                    Thread.Sleep(3000);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Connection failed: {ex.Message}", ex);
                ConsoleHelper.ColorWriteLineWithReset("An error occurred while connecting to the database. Please check the logs for details. Returning to main menu...", ConsoleColor.DarkRed);
                Console.WriteLine();
                return false;
            }
        }
    }
}