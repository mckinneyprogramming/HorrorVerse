using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// Provides a base class for managing database operations and user interface interactions within the application.
    /// Derived classes implement specific management functionality and menu options.
    /// </summary>
    /// <remarks>This class is intended to be inherited by specialized manager types that define their own
    /// menu titles and options. It encapsulates common functionality for displaying menus and handling user input.
    /// Thread safety is not guaranteed; derived classes should ensure appropriate synchronization if accessed
    /// concurrently.</remarks>
    /// <param name="connectionString">The connection string used to establish a connection to the database. Cannot be null or empty.</param>
    /// <param name="logger">The logger service used for recording application events and errors. Cannot be null.</param>
    /// <param name="horrorConsole">The console interface used for displaying styled output and interacting with the user. Cannot be null.</param>
    /// <param name="systemFunctions">The system functions provider used for accessing platform-specific operations. Cannot be null.</param>
    public abstract class Manager(
        string connectionString,
        ILoggerService logger,
        IHorrorConsole horrorConsole,
        ISystemFunctions systemFunctions)
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        protected readonly string ConnectionString = connectionString;

        /// <summary>
        /// The logger.
        /// </summary>
        protected readonly ILoggerService Logger = logger;

        /// <summary>
        /// The horror console.
        /// </summary>
        protected readonly IHorrorConsole HorrorConsole = horrorConsole;

        /// <summary>
        /// The system functions.
        /// </summary>
        protected readonly ISystemFunctions SystemFunctions = systemFunctions;

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
        protected void DisplayManagerTitles()
        {
            Console.Title = ConsoleStrings.Title(RetrieveTitle());

            HorrorConsole.Clear();
            HorrorConsole.SetForegroundColor(ConsoleColor.Red);
            HorrorConsole.MarkupLine($"========== {RetrieveTitle()} ==========");
            HorrorConsole.ResetColor();

            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.DarkGray, 25, "Choose an option below to get started adding items to your database!");
            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();
        }

        /// <summary>
        /// Retrieves the menu selection for the manager.
        /// </summary>
        /// <param name="menuTitle">The menu title.</param>
        /// <returns>The user selection.</returns>
        protected string RetrieveMenuSelection(string menuTitle)
        {
            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            return themersFactory.SpookyTextStyler.InteractiveMenu(menuTitle, RetrieveMenuOptions());
        }

        /// <summary>
        /// Retrieves the title for the menu.
        /// </summary>
        /// <returns>The title string.</returns>
        protected abstract string RetrieveTitle();

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        protected abstract string[] RetrieveMenuOptions();
    }
}