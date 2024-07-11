namespace HorrorTracker.Utilities.Parsing.Interfaces
{
    /// <summary>
    /// The <see cref="IParser"/> interface.
    /// </summary>
    public interface IParser
    {
        /// <summary>
        /// Checks if the string value is an integer.
        /// </summary>
        /// <param name="value">The string value.</param>
        /// <param name="integer">The integer from the parse.</param>
        /// <returns>True if the value is an integer; false otherwise.</returns>
        bool IsInteger(string? value, out int integer);

        /// <summary>
        /// Checks if the object is a decimal.
        /// </summary>
        /// <param name="input">The object.</param>
        /// <param name="result">The decimal value.</param>
        /// <returns>True if the object is a decimal; false otherwise.</returns>
        bool IsDecimal(object input, out decimal result);

        /// <summary>
        /// Checks if the string is not null, empty, or whitespace.
        /// </summary>
        /// <param name="value">Teh string value.</param>
        /// <returns>True if the value is valid; false otherwise.</returns>
        bool StringIsNull(string? value);
    }
}