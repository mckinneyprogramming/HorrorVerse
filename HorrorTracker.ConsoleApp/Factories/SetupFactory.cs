using HorrorTracker.ConsoleApp.Core;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.ConsoleApp.Factories
{
    /// <summary>
    /// The <see cref="SetupFactory"/> class.
    /// </summary>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="console">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class SetupFactory(string connectionString, ILoggerService logger, IHorrorConsole console, ISystemFunctions systemFunctions)
        : ISetupFactory
    {
        private readonly string _connectionString = connectionString;
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _console = console;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <inheritdoc/>
        public CoreSetup CreateCoreSetup()
        {
            var dbConnection = new DatabaseConnection(_connectionString);
            return new CoreSetup(dbConnection, _logger, _console, _systemFunctions);
        }

        /// <inheritdoc/>
        public CoreMenuSetup CreateCoreMenuSetup(CoreSetup coreSetup)
        {
            return new CoreMenuSetup(coreSetup.SetupHorrorConnections(), _console, _systemFunctions);
        }
    }
}