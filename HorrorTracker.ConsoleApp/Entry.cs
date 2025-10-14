using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.Utilities.Logging;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp
{
    /// <summary>
    /// Provides the entry point for the application.
    /// </summary>
    /// <remarks>
    /// The Main method initializes essential services and components before starting the main
    /// program logic. It is typically invoked automatically when the application is launched.
    /// </remarks>
    [ExcludeFromCodeCoverage]
    static class Entry
    {
        /// <summary>
        /// Serves as the entry point for the application.
        /// </summary>
        /// <remarks>
        /// This method initializes required services and components, then starts the main
        /// program logic. It is typically called automatically when the application is launched.
        /// </remarks>
        static void Main()
        {
            var connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb");
            var logger = new LoggerService();
            var horrorConsole = new HorrorConsole();
            var systemFunctions = new SystemFunctions();

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                horrorConsole.SetForegroundColor(ConsoleColor.Red);
                horrorConsole.MarkupLine("Error: Database connection string is not set." +
                    " Please check or set the 'HorrorVerseDb' environment variable.");
                return;
            }

            var program = new Program(connectionString, logger, horrorConsole, systemFunctions);
            program.Main();
        }
    }
}