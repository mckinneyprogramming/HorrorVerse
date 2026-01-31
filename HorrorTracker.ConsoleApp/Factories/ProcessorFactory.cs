using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Factories
{
    /// <summary>
    /// The <see cref="ProcessorFactory"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="ProcessorFactory"/> class.
    /// </remarks>
    /// <param name="logger">The logger service.</param>
    /// <param name="console">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class ProcessorFactory(ILoggerService logger, IHorrorConsole console, ISystemFunctions systemFunctions) : IProcessorFactory
    {
        private readonly ILoggerService _logger = logger;
        private readonly IHorrorConsole _console = console;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <inheritdoc/>
        public DecisionProcessor CreateDecisionProcessor() => new(new Parser(), _logger, _console, _systemFunctions);
    }
}