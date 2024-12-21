using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Data;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.MathFunctions;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Handles the setup and display of the main menu for the Horror Tracker application.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="CoreMenuSetup"/> class.
    /// </remarks>
    /// <param name="horrorConnections">The horror connections.</param>
    /// <param name="logger">The logger service.</param>
    public class CoreMenuSetup(HorrorConnections horrorConnections, LoggerService logger)
    {
        private readonly HorrorConnections _horrorConnections = horrorConnections;
        private readonly LoggerService _logger = logger;

        /// <summary>
        /// Displays the main menu.
        /// </summary>
        public void DisplayMainMenu()
        {
            ConsoleHelper.PrintHeaderTitle("========== Horror Tracker ==========", ConsoleColor.Red);
            ConsoleHelper.TypeMessage("The Horror Tracker system uses TMDB (The Movie Database) API to quickly add items.");
            ConsoleHelper.TypeMessage("You will have the option below to add items manually or from TMDB API.");
            Console.WriteLine();

            DisplayOverallSystemInformation();
            Thread.Sleep(1000);

            Console.ResetColor();
            Console.WriteLine(
                "1. Use TMDB API\n" +
                "2. CRUD Database\n" +
                "3. Display Upcoming Movies\n" +
                "4. Account Details\n" +
                "5. Exit");
            Console.Write(">> ");

            _logger.LogInformation("Main menu displayed.");
        }

        /// <summary>
        /// Displays overall information from the database.
        /// </summary>
        private void DisplayOverallSystemInformation()
        {
            var overallRepository = _horrorConnections.RetrieveOverallRepository();
            var (overallHours, overallDays) = ConvertTime(overallRepository.GetOverallTime());
            var (leftHours, leftDays) = ConvertTime(overallRepository.GetOverallTimeLeft());

            ConsoleHelper.PrintHeaderTitle("===== Overall Information =====", ConsoleColor.Red);
            Console.WriteLine($"Overall Time in the Database:\n- In Hours: {overallHours}\n- In Days: {overallDays}");
            Console.WriteLine($"Time Left to Watch:\n- In Hours: {leftHours}\n- In Days: {leftDays}\n");
        }

        /// <summary>
        /// Converts time from minutes to hours and days.
        /// </summary>
        /// <param name="timeInMinutes">The time in minutes.</param>
        /// <returns>Tuple containing hours and days.</returns>
        private static (decimal hours, decimal days) ConvertTime(decimal timeInMinutes)
        {
            var hours = SimpleMathFunctions.Divide(timeInMinutes, 60);
            var days = SimpleMathFunctions.Divide(hours, 24);
            return (hours, days);
        }
    }
}
