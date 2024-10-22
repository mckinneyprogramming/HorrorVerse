using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="AccountManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
    public class AccountManager : Manager
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="AccountManager"/> class.
        /// </summary>
        /// <param name="logger">The logger service.</param>
        public AccountManager(LoggerService logger)
            : base(logger)
        {
        }

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
            "1. View Lists\n" +
            "2. Add Movies to List\n" +
            "3. Delete Movies from List\n" +
            "4. Exit";

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "Account Lists";
    }
}