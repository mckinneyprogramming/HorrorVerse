using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Managers.Interfaces;
using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="ManualManager"/> class.
    /// </summary>
    /// <seealso cref="IManager"/>
    public class ManualManager : IManager
    {
        /// <summary>
        /// The logger service.
        /// </summary>
        private readonly LoggerService _logger;

        /// <summary>
        /// IsNotDone indicator.
        /// </summary>
        private bool IsNotDone = true;

        /// <summary>
        /// Initializes a new instance of the <see cref="ManualManager"/> class.
        /// </summary>
        /// <param name="logger">The logger.</param>
        public ManualManager(LoggerService logger)
        {
            _logger = logger;
        }

        /// <inheritdoc/>
        public void Manage()
        {
            while (IsNotDone)
            {
                Console.Title = ConsoleTitles.RetrieveTitle("Manual CRUD");

                Console.Clear();
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("========== Manual CRUD ==========");

                Console.ForegroundColor = ConsoleColor.DarkGray;
                ConsoleHelper.TypeMessage("Choose an option below to get started adding items to your database!");
                Console.ResetColor();
                ConsoleHelper.NewLine();

                Console.WriteLine(
                    "1. Series\n" +
                    "2. Movie\n" +
                    "3. Documentary\n" +
                    "4. TV Show\n" +
                    "5. Episode\n" +
                    "6. Exit");
                Console.Write(">> ");

                _logger.LogInformation("TMDB API Menu displayed.");
            }
        }
    }
}