using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Managers;
using HorrorTracker.Data;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Utilities.Logging;
using System.Configuration;

namespace HorrorTracker.ConsoleApp
{
    /// <summary>
    /// The <see cref="Program"/> class.
    /// </summary>
    class Program
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        private static readonly string _connectionString = ConfigurationManager.ConnectionStrings["HorrorTracker"].ConnectionString;

        /// <summary>
        /// IsNotDone indicator.
        /// </summary>
        private static bool IsNotDone = true;

        /// <summary>
        /// The main method.
        /// </summary>
        /// <param name="args">The arguments.</param>
        static void Main(string[] args)
        {
            var logger = new LoggerService();
            logger.LogInformation("HorrorTracker has started.");

            try
            {
                Console.Title = ConsoleTitles.RetrieveTitle("Home");

                TestDatabaseConnection(logger);

                while (IsNotDone)
                {
                    Console.Clear();
                    DisplayMainMenu(logger);
                    var decision = ConsoleHelper.GetUserInput();
                    var actualNumber = ConsoleHelper.ParseNumberDecision(logger, decision);
                    var actions = MainMenuDecisionActions(logger);

                    ConsoleHelper.ProcessDecision(actualNumber, logger, actions);
                }
            }
            catch (Exception ex)
            {
                logger.LogError("An unexpected error occurred.", ex);
            }
            finally
            {
                logger.LogInformation("HorrorTracker has ended.");
                logger.CloseAndFlush();
                ExitApplication();
            }
        }

        /// <summary>
        /// Tests the connection to the database.
        /// </summary>
        /// <param name="logger">The logger.</param>
        private static void TestDatabaseConnection(LoggerService logger)
        {
            logger.LogInformation("Testing the Postgre database server and connection to the HorrorTracker database.");
            ConsoleHelper.GroupedConsole(ConsoleColor.DarkGray, "We are testing the connection to the database. Please standby.");
            ConsoleHelper.ThinkingAnimation("Testing", 10, "Testing Complete!");
            ConsoleHelper.NewLine();

            try
            {
                var databaseConnection = new DatabaseConnection(_connectionString);
                var connections = new HorrorConnections(databaseConnection, logger);
                var connectionMessage = connections.Connect();

                if (connectionMessage.Contains("successful!"))
                {
                    _ = connections.CreateTables();
                    ConsoleHelper.GroupedConsole(ConsoleColor.Green, connectionMessage);
                    ConsoleHelper.ThinkingAnimation("Directing to Main Menu", 10, "Have Fun!");
                    Thread.Sleep(3000);
                }
                else
                {
                    ConsoleHelper.GroupedConsole(ConsoleColor.DarkRed, connectionMessage);
                    ConsoleHelper.ThinkingAnimation("Exiting Horror Tracker", 10, "Goodbye!");
                    Thread.Sleep(3000);

                    IsNotDone = false;
                }
            }
            catch (Exception ex)
            {
                logger.LogError("Failed to connect to the database.", ex);
                ConsoleHelper.GroupedConsole(ConsoleColor.DarkRed, "Failed to connect to the database. Exiting...");
                IsNotDone = false;
            }
        }

        /// <summary>
        /// Displays the main menu.
        /// </summary>
        private static void DisplayMainMenu(LoggerService logger)
        {
            ConsoleHelper.GroupedConsole(ConsoleColor.Red, "========== Horror Tracker ==========");
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("The Horror Tracker system uses TMDB (The Movie Database) API to quickly add items.");
            ConsoleHelper.TypeMessage("You will have the option below to add items manually or from TMDB API.");
            ConsoleHelper.NewLine();
            Thread.Sleep(2000);

            Console.ResetColor();
            Console.WriteLine(
                "1. Use TMDB API\n" +
                "2. Manually Add\n" +
                "3. Exit");
            Console.Write(">> ");

            logger.LogInformation("Main menu displayed.");
        }

        /// <summary>
        /// Retrieves the main menu decision actions.
        /// </summary>
        /// <param name="logger">The logger.</param>
        /// <returns>The dictionary of actions.</returns>
        private static Dictionary<int, Action> MainMenuDecisionActions(LoggerService logger)
        {
            return new Dictionary<int, Action>
            {
                { 1, () => new MovieDatabaseApiManager(logger, _connectionString).Manage() },
                { 2, () => new ManualManager(logger).Manage() },
                { 3, () => { IsNotDone = false; logger.LogInformation("Selected to exit."); } }
            };
        }

        /// <summary>
        /// Exits the application.
        /// </summary>
        private static void ExitApplication()
        {
            Console.ResetColor();
            Console.Write("Press any key to exit...");
            _ = Console.ReadKey();
        }
    }
}