using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
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
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class CoreMenuSetup(HorrorConnections horrorConnections, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        private readonly HorrorConnections _horrorConnections = horrorConnections;
        private readonly LoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <summary>
        /// Displays the intro of the HorrorVerse.
        /// </summary>
        public void DisplayHorrorVerseIntro()
        {
            _horrorConsole.SetForegroundColor(ConsoleColor.Red);
            _horrorConsole.MarkupLine("========== Welcome to HorrorVerse ==========");
            _horrorConsole.ResetColor();

            var themersFactory = new ThemersFactory(_horrorConsole, _systemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(
                ConsoleColor.DarkGray,
                25,
                "The Horror Tracker system uses TMDB (The Movie Database) API to quickly add items.",
                "You will have the option below to add items manually or from TMDB API.");

            _horrorConsole.WriteLine();

            DisplayOverallSystemInformation();
            _systemFunctions.Sleep(1000);
        }

        /// <summary>
        /// Displays the main menu.
        /// </summary>
        public string DisplayMainMenu()
        {
            var themersFactory = new ThemersFactory(_horrorConsole, _systemFunctions);
            var options = new string[] { "1. Use TMDB API", "2. CRUD Database", "3. Display Upcoming Movies", "4. Account Details", "5. Exit" };
            return themersFactory.SpookyTextStyler.InteractiveMenu("=== HorrorVerse Main Menu ===", options);
        }

        /// <summary>
        /// Displays overall information from the database.
        /// </summary>
        private void DisplayOverallSystemInformation()
        {
            var overallRepository = _horrorConnections.RetrieveOverallRepository();
            var (overallHours, overallDays) = ConvertTime(overallRepository.GetOverallTime());
            var (leftHours, leftDays) = ConvertTime(overallRepository.GetOverallTimeLeft());

            _horrorConsole.SetForegroundColor(ConsoleColor.Red);
            _horrorConsole.MarkupLine("===== Overall Information =====");
            _horrorConsole.ResetColor();
            _horrorConsole.MarkupLine($"Overall Time in the Database:\n- In Hours: {overallHours}\n- In Days: {overallDays}");
            _horrorConsole.MarkupLine($"Time Left to Watch:\n- In Hours: {leftHours}\n- In Days: {leftDays}\n");
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