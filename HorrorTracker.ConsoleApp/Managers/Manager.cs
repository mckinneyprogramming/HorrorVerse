using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="Manager"/> abstract class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="Manager"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger.</param>
    public abstract class Manager(string? connectionString, LoggerService logger)
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        protected readonly string? ConnectionString = connectionString;

        /// <summary>
        /// The logger.
        /// </summary>
        protected readonly LoggerService Logger = logger;

        /// <summary>
        /// The parser.
        /// </summary>
        protected readonly Parser Parser = new();

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

            Logger.LogInformation($"{RetrieveTitle()} Menu displayed.");
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