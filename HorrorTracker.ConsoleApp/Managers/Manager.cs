using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
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
    /// <param name="horrorConsole">the horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public abstract class Manager(string? connectionString, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
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
        protected void DisplayManagerMenus()
        {
            Console.Title = ConsoleTitles.Title(RetrieveTitle());

            HorrorConsole.Clear();
            HorrorConsole.SetForegroundColor(ConsoleColor.Red);
            HorrorConsole.MarkupLine($"========== {RetrieveTitle()} ==========");
            HorrorConsole.ResetColor();

            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.DarkGray, 25, "Choose an option below to get started adding items to your database!");
            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();
            HorrorConsole.MarkupLine(RetrieveMenuOptions());
            HorrorConsole.Write(">> ");

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