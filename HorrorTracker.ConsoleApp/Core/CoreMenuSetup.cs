using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Data;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.MathFunctions;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// The <see cref="CoreMenuSetup"/> class.
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
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("========== Horror Tracker ==========");
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("The Horror Tracker system uses TMDB (The Movie Database) API to quickly add items.");
            ConsoleHelper.TypeMessage("You will have the option below to add items manually or from TMDB API.");
            Console.WriteLine();
            OverallSystemInformation();
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
        /// Displays the overall information from the database.
        /// </summary>
        private void OverallSystemInformation()
        {
            var overallRepository = _horrorConnections.RetrieveOverallRepository();
            var (overallHours, overallDays) = ConvertTime(overallRepository.GetOverallTime());
            var (leftHours, leftDays) = ConvertTime(overallRepository.GetOverallTimeLeft());

            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("===== Overall Information =====");
            Console.ResetColor();
            Console.WriteLine(
                $"Overall Time in the Database:\n" +
                $"- In Hours: {overallHours}\n" +
                $"- In Days: {overallDays}");
            Console.WriteLine(
                $"Overall Time left to Watch in the Database:\n" +
                $"- In Hours: {leftHours}\n" +
                $"- In Days: {leftDays}\n");
        }

        /// <summary>
        /// Retrieves the hours and days calulations for the overall times.
        /// </summary>
        /// <param name="timeInMinutes">The time in minutes.</param>
        /// <returns>The hours and days calculations.</returns>
        private static (decimal hours, decimal days) ConvertTime(decimal timeInMinutes)
        {
            var hours = SimpleMathFunctions.Divide(timeInMinutes, 60);
            var days = SimpleMathFunctions.Divide(hours, 24);
            return (hours, days);
        }
    }
}