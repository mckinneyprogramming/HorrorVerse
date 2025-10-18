using HorrorTracker.ConsoleApp.ConsoleHelpers;

namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="IProcessorFactory"/> interface.
    /// </summary>
    public interface IProcessorFactory
    {
        /// <summary>
        /// Creates the <see cref="DecisionProcessor"/> object.
        /// </summary>
        /// <returns>The <see cref="DecisionProcessor"/> object.</returns>
        DecisionProcessor CreateDecisionProcessor();
    }
}