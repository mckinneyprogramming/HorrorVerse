using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="ManualManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
    /// <remarks>
    /// Initializes a new instance of the <see cref="ManualManager"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger.</param>
    public class ManualManager(string? connectionString, LoggerService logger) : Manager(connectionString, logger)
    {
        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerMenus();
                var decision = Console.ReadLine();
            }
        }

        /// <inheritdoc/>
        protected override string RetrieveMenuOptions() =>
            "1. Series\n" +
            "2. Movie\n" +
            "3. Documentary\n" +
            "4. TV Show\n" +
            "5. Episode\n" +
            "6. Exit";

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "Manual CRUD";
    }
}