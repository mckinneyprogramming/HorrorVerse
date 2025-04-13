using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Core;
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
        private static readonly string? _connectionString = Environment.GetEnvironmentVariable("HorrorTrackerDb");
        private static readonly LoggerService _logger = new();

        /// <summary>
        /// The main method.
        /// </summary>
        /// <param name="args">The arguments.</param>
        static void Main(string[] args)
        {
            _logger.LogInformation("HorrorTracker has started.");

            try
            {
                Console.Title = ConsoleTitles.Title("Home");
                HorrorTrackerUi horrorTrackerApp = new(_connectionString, _logger);
                horrorTrackerApp.Run();
            }
            catch (Exception ex)
            {
                _logger.LogError("An unexpected error occurred.", ex);
            }
            finally
            {
                _logger.LogInformation("HorrorTracker has ended.");
                _logger.CloseAndFlush();

                Console.ResetColor();
                Console.Write("Press any key to exit...");
                _ = Console.ReadKey();
            }
        }
    }
}