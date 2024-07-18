using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="ManualManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
    public class ManualManager : Manager
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        private readonly string? _connectionString;

        /// <summary>
        /// IsNotDone indicator.
        /// </summary>
        private bool IsNotDone = true;

        /// <summary>
        /// Initializes a new instance of the <see cref="ManualManager"/> class.
        /// </summary>
        /// <param name="logger">The logger.</param>
        public ManualManager(string? connectionString, LoggerService logger)
            : base(logger)
        {
            _connectionString = connectionString;
        }

        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerMenus();
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