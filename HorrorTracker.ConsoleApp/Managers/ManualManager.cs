using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
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
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class ManualManager(string? connectionString, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
        : Manager(connectionString, logger, horrorConsole, systemFunctions)
    {
        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerTitles();
                var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
                var decision = themersFactory.SpookyTextStyler.InteractiveMenu("=== CRUD Menu ===", RetrieveMenuOptions());
            }
        }

        /// <inheritdoc/>
        protected override string[] RetrieveMenuOptions() => ["1. Series", "2. Movie", "3. Documentary", "4. TV Show", "5. Episode", "6. Exit"];

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "Manual CRUD";
    }
}