using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="Manager"/> abstract class.
    /// </summary>
    public abstract class Manager
    {
        /// <summary>
        /// The logger.
        /// </summary>
        protected readonly LoggerService _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="Manager"/> class.
        /// </summary>
        /// <param name="logger">The logger.</param>
        protected Manager(LoggerService logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Performs actions on the database based on user input.
        /// </summary>
        public abstract void Manage();

        /// <summary>
        /// Displays the UI manager menus.
        /// </summary>
        protected void DisplayManagerMenus()
        {
            Console.Title = ConsoleTitles.Title(RetrieveTitle());

            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"========== {RetrieveTitle()} ==========");

            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("Choose an option below to get started adding items to your database!");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine(RetrieveMenuOptions());
            Console.Write(">> ");

            _logger.LogInformation($"{RetrieveTitle()} Menu displayed.");
        }

        /// <summary>
        /// Retrieves the title for the menu.
        /// </summary>
        /// <returns></returns>
        protected abstract string RetrieveTitle();

        /// <summary>
        /// Retrieves the menu options to display.
        /// </summary>
        /// <returns></returns>
        protected abstract string RetrieveMenuOptions();
    }
}