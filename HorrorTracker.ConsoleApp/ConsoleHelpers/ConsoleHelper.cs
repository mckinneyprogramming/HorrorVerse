using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.ConsoleHelpers
{
    /// <summary>
    /// The <see cref="ConsoleHelper"/> class.
    /// </summary>
    public static class ConsoleHelper
    {
        /// <summary>
        /// Writes a new line to the console.
        /// </summary>
        public static void NewLine()
        {
            Console.WriteLine();
        }

        /// <summary>
        /// Loading animation.
        /// </summary>
        [ExcludeFromCodeCoverage]
        public static void ThinkingAnimation(string initialText, int numberOfDots, string doneText)
        {
            Console.Write(initialText);

            for (int i = 0; i < numberOfDots; i++)
            {
                Console.Write(".");
                Thread.Sleep(500);
            }

            Console.SetCursorPosition(0, Console.CursorTop);
            Console.Write(new string(' ', Console.WindowWidth));
            Console.SetCursorPosition(0, Console.CursorTop);

            Console.WriteLine(doneText);
        }

        /// <summary>
        /// Group of console functions to reduce number of calls.
        /// </summary>
        /// <param name="consoleColor">The console color.</param>
        /// <param name="writeLine">The <see cref="Console.WriteLine()"/> message.</param>
        public static void GroupedConsole(ConsoleColor consoleColor, string writeLine)
        {
            Console.ForegroundColor = consoleColor;
            Console.WriteLine(writeLine);
            NewLine();
            Console.ResetColor();
        }

        /// <summary>
        /// Types the message out.
        /// </summary>
        /// <param name="message">The message.</param>
        public static void TypeMessage(string message)
        {
            foreach (var character in message)
            {
                Console.Write(character);
                Thread.Sleep(25);
            }

            NewLine();
        }

        /// <summary>
        /// Gets user input from the console.
        /// </summary>
        /// <returns>User input.</returns>
        public static string? GetUserInput()
        {
            return Console.ReadLine();
        }

        /// <summary>
        /// Parses the number decision.
        /// </summary>
        /// <param name="logger">The logger.</param>
        /// <param name="decision">The decision.</param>
        /// <returns>The actual number if there is one.</returns>
        public static int ParseNumberDecision(ILoggerService logger, string? decision)
        {
            logger.LogInformation($"User input: {decision}");
            var parser = new Parser();
            _ = parser.IsInteger(decision, out var actualNumber);

            return actualNumber;
        }

        /// <summary>
        /// Processes the main decision based on user input.
        /// </summary>
        /// <param name="actualNumber">The actual number.</param>
        /// <param name="logger">The logger.</param>
        /// <param name="actions">The dictionary of actions.</param>
        public static void ProcessDecision(int actualNumber, ILoggerService logger, Dictionary<int, Action> actions)
        {
            logger.LogInformation($"Processing decision: {actualNumber}");
            PerformActionsBasedOnDecision(actualNumber, logger, actions);
        }

        /// <summary>
        /// Performs the actions based on the user selection.
        /// </summary>
        /// <param name="actualNumber">The decision number.</param>
        /// <param name="logger">The logger.</param>
        /// <param name="actions">The dictionary of actions.</param>
        public static void PerformActionsBasedOnDecision(int actualNumber, ILoggerService logger, Dictionary<int, Action> actions)
        {
            try
            {
                if (actions.TryGetValue(actualNumber, out Action? value))
                {
                    value();
                }
                else
                {
                    logger.LogWarning("Invalid selection made.");
                    GroupedConsole(ConsoleColor.DarkRed, "Invalid selection. Please enter a valid number.");
                    Thread.Sleep(3000);
                }
            }
            catch (Exception ex)
            {
                logger.LogError("Error processing decision.", ex);
                GroupedConsole(ConsoleColor.DarkRed, "An error occurred while processing your selection. Please try again.");
                Thread.Sleep(3000);
            }
        }
    }
}