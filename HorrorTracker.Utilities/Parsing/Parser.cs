using HorrorTracker.Utilities.Parsing.Interfaces;

namespace HorrorTracker.Utilities.Parsing
{
    /// <summary>
    /// The <see cref="Parser"/> class.
    /// </summary>
    public class Parser : IParser
    {
        /// <inheritdoc/>
        public bool IsInteger(string? value, out int integer)
        {
            return int.TryParse(value, out integer);
        }

        /// <inheritdoc/>
        public bool IsDecimal(object input, out decimal result)
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