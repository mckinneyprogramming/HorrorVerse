using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.ConsoleHelpers
{
    /// <summary>
    /// The <see cref="DecisionProcessor"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="DecisionProcessor"/> class.
    /// </remarks>
    /// <param name="parser">the parser.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class DecisionProcessor(Parser parser, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        private readonly Parser _parser = parser;
        private readonly LoggerService _logger = logger;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <summary>
        /// Processes the main decision based on user input.
        /// </summary>
        /// <param name="decision">The decision.</param>
        /// <param name="actions">The dictionary of actions.</param>
        public void Process(string decision, Dictionary<int, Action> actions)
        {
            _logger.LogInformation($"User input: {decision}");
            var decisionNumber = decision.First().ToString();
            _ = _parser.IsInteger(decisionNumber, out var actualNumber);

            _logger.LogInformation($"Processing decision: {actualNumber}");
            PerformActionsBasedOnDecision(actualNumber, actions);
        }

        /// <summary>
        /// Performs the actions based on the user selection.
        /// </summary>
        /// <param name="actualNumber">The decision number.</param>
        /// <param name="actions">The dictionary of actions.</param>
        private void PerformActionsBasedOnDecision(int actualNumber, Dictionary<int, Action> actions)
        {
            try
            {
                if (actions.TryGetValue(actualNumber, out Action? value))
                {
                    value();
                }
                else
                {
                    _logger.LogWarning("Invalid selection made.");
                    _horrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                    _horrorConsole.MarkupLine("Invalid selection. Please enter a valid number.");
                    _horrorConsole.WriteLine();
                    _horrorConsole.ResetColor();
                    _systemFunctions.Sleep(3000);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Error processing decision.", ex);
                _horrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                _horrorConsole.MarkupLine("An error occurred while processing your selection. Please try again.");
                _horrorConsole.WriteLine();
                _horrorConsole.ResetColor();
                _systemFunctions.Sleep(3000);
            }
        }
    }
}