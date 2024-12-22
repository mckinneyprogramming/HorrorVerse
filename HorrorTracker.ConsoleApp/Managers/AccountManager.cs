using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="AccountManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
    /// <remarks>
    /// Initializes a new instance of the <see cref="AccountManager"/> class.
    /// </remarks>
    /// <param name="logger">The logger service.</param>
    public class AccountManager(LoggerService logger) : Manager(null, logger)
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
            "1. View Lists\n" +
            "2. Add Movies to List\n" +
            "3. Delete Movies from List\n" +
            "4. Exit";

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "Account Lists";
    }
}