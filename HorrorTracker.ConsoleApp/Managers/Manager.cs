using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="Manager"/> abstract class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="Manager"/> class.
    /// </remarks>
    /// <param name="logger">The logger.</param>
    public abstract class Manager(LoggerService logger)
    {
        /// <summary>
        /// The logger.
        /// </summary>
        protected readonly LoggerService _logger = logger;

        /// <summary>
        /// IsNotDone indicator.
        /// </summary>
        protected bool IsNotDone = true;

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
            ConsoleHelper.ColorWriteLineWithReset($"========== {RetrieveTitle()} ==========", ConsoleColor.Red);

            ConsoleHelper.TypeMessage(ConsoleColor.DarkGray, "Choose an option below to get started adding items to your database!");
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