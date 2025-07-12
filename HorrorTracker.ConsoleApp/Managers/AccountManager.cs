using HorrorTracker.ConsoleApp.Interfaces;
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
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class AccountManager(LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
        : Manager(null, logger, horrorConsole, systemFunctions)
    {
        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerMenus();

                var decision = HorrorConsole.ReadLine();
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