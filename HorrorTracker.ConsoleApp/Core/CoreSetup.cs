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
        /// Tests that the database is connected and running.
        /// </summary>
        /// <returns>True or false.</returns>
        public bool TestDatabase()
        {
            return TestDatabaseConnection(SetupHorrorConnections());
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
        /// <param name="connections">The horror connections.</param>
        /// <returns>True or false.</returns>
        private bool TestDatabaseConnection(HorrorConnections connections)
        {
            _logger.LogInformation("Testing the Postgre database server and connection to the HorrorTracker database.");
            TestingDatabaseConnectionMessage(ConsoleColor.DarkGray, "We are testing the connection to the database. Please standby.", "Testing", "Testing Complete!");
            Console.WriteLine();

            try
            {
                var connectionMessage = connections.Connect();
                if (connectionMessage.Contains("successful!"))
                {
                    _ = connections.CreateTables();
                    TestingDatabaseConnectionMessage(ConsoleColor.Green, connectionMessage, "Directing to Main Menu", "Have fun!");
                    Thread.Sleep(3000);
                    return true;
                }
                else
                {
                    TestingDatabaseConnectionMessage(ConsoleColor.Red, connectionMessage, "Exiting Horror Tracker", "Goodbye!");
                    Thread.Sleep(3000);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Connection failed: {ex.Message}", ex);
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("An error occurred while connecting to the database. Please check the logs for details. Returning to main menu...");
                Console.WriteLine();
                Console.ResetColor();
                return false;
            }
        }

        /// <summary>
        /// Displays the message for success or fail connection.
        /// </summary>
        /// <param name="foregroundColor">The foreground color.</param>
        /// <param name="connectionMessage">The connection message.</param>
        /// <param name="initialThinkingMessage">The initial thinking animation message.</param>
        /// <param name="finalThinkingMessage">The final thinking animation message.</param>
        private static void TestingDatabaseConnectionMessage(
            ConsoleColor foregroundColor,
            string connectionMessage,
            string initialThinkingMessage,
            string finalThinkingMessage)
        {
            Console.ForegroundColor = foregroundColor;
            Console.WriteLine(connectionMessage);
            Console.WriteLine();
            Console.ResetColor();
            ConsoleHelper.ThinkingAnimation(initialThinkingMessage, 10, finalThinkingMessage);
        }
    }
}