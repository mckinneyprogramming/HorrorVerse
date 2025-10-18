using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.ConsoleApp.Managers;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.ConsoleApp.Factories
{
    /// <summary>
    /// The <see cref="ManagerFactory"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="ManagerFactory"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="console">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class ManagerFactory(string connectionString, ILoggerService logger, IHorrorConsole console, ISystemFunctions systemFunctions)
        : IManagerFactory
    {
        private readonly string _connectionString = connectionString;
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _console = console;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <inheritdoc/>
        public MovieDatabaseApiManager CreateMovieDatabaseApiManager() => new(_logger, _connectionString, _console, _systemFunctions);

        /// <inheritdoc/>
        public ManualManager CreateManualManager() => new(_connectionString, _logger, _console, _systemFunctions);

        /// <inheritdoc/>
        public AccountManager CreateAccountManager() => new(_logger, _console, _systemFunctions);
    }
}