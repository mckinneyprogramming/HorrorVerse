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

        /// <summary>
        /// Checks if the object is a decimal.
        /// </summary>
        /// <param name="input">The object.</param>
        /// <param name="result">The decimal value.</param>
        /// <returns>True if the object is a decimal; false otherwise.</returns>
        public static bool IsDecimal(object input, out decimal result)
        {
            if (input is decimal decimalValue)
            {
                result = decimalValue;
                return true;
            }
            else if (input is string stringValue)
            {
                return decimal.TryParse(stringValue, out result);
            }

            result = 0.0M;
            return false;
        }
    }
}