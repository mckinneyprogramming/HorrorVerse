namespace HorrorTracker.ConsoleApp.ConsoleHelpers
{
    /// <summary>
    /// Provides utility methods for generating standardized console strings, such as titles and prompts, for console
    /// applications.
    /// </summary>
    /// <remarks>
    /// This class is static and cannot be instantiated. All members are thread-safe and intended for
    /// use in console-based user interfaces to ensure consistent formatting of common strings.
    /// </remarks>
    public static class ConsoleStrings
    {
        /// <summary>
        /// Represents the base title prefix used for application page titles.
        /// </summary>
        private const string BaseTitle = "HorrorVerse -";

        /// <summary>
        /// Generates a full title string by combining the base title with the specified subtitle.
        /// </summary>
        /// <param name="subtitle">The subtitle to append to the base title. Cannot be null.</param>
        /// <returns>A string containing the base title followed by the specified subtitle, separated by a space.</returns>
        public static string Title(string subtitle)
        {
            return $"{BaseTitle} {subtitle}";
        }

        /// <summary>
        /// Generates a prompt instructing the user to press any key to complete the specified action.
        /// </summary>
        /// <param name="finishedSentenceString">
        /// A string describing the action to be completed when the user presses any key. This should be a short,
        /// imperative phrase such as "continue" or "exit".
        /// </param>
        /// <returns>A formatted string prompting the user to press any key to perform the specified action.</returns>
        public static string PressAnyKey(string finishedSentenceString)
        {
            return $"Press any key to {finishedSentenceString}...";
        }
    }
}