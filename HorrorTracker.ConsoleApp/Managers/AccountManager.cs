using HorrorTracker.ConsoleApp.Factories;
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
                DisplayManagerTitles();
                var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
                var decision = themersFactory.SpookyTextStyler.InteractiveMenu("=== Account Menu ===", RetrieveMenuOptions());
            }
        }

        /// <inheritdoc/>
        protected override string[] RetrieveMenuOptions() => ["1. View Lists", "2. Add Movies to List", "3. Delete Moves from List", "4. Exit"];

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "Account Lists";
    }
}