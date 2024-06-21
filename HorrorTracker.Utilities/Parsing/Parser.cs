namespace HorrorTracker.Utilities.Parsing
{
    /// <summary>
    /// The <see cref="Parser"/> class.
    /// </summary>
    public static class Parser
    {
        /// <summary>
        /// Checks if the string value is an integer.
        /// </summary>
        /// <param name="value">The string value.</param>
        /// <param name="integer">The integer from the parse.</param>
        /// <returns>True if the value is an integer; false otherwise.</returns>
        public static bool IsInteger(string? value, out int integer)
        {
            return int.TryParse(value, out integer);
        }
    }
}