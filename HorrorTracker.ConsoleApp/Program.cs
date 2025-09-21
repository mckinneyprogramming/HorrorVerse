using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.ConsoleApp.Core;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.Utilities.Logging;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp
{
    /// <summary>
    /// The <see cref="Program"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    static class Program
    {
        private static readonly string? _connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb");
        private static readonly LoggerService _logger = new();
        private static readonly HorrorConsole _horrorConsole = new();
        private static readonly SystemFunctions _systemFunctions = new();

        /// <summary>
        /// The main method.
        /// </summary>
        static void Main()
        {
            _logger.LogInformation("HorrorTracker has started.");

            try
            {
                Console.Title = ConsoleTitles.Title("Home");

                var themersFactory = new ThemersFactory(_horrorConsole, _systemFunctions);
                var spookyStartupGenerator = new SpookyStartupGenerator(themersFactory, _horrorConsole, _systemFunctions);
                spookyStartupGenerator.Startup();
                _horrorConsole.Markup("Press any key to continue...");
                _horrorConsole.ReadKey(true);
                _horrorConsole.Clear();

                HorrorVerseUi horrorVerseUi = new(_connectionString, _logger, _horrorConsole, _systemFunctions);
                horrorVerseUi.Run();
            }
            catch (Exception ex)
            {
                _logger.LogError("An unexpected error occurred.", ex);
            }
            finally
            {
                _logger.LogInformation("HorrorTracker has ended.");
                _logger.CloseAndFlush();

                _horrorConsole.ResetColor();
                _horrorConsole.Write("Press any key to exit...");
                _ = Console.ReadKey();
            }
        }
    }
}