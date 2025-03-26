namespace HorrorTracker.Utilities
{
    /// <summary>
    /// The <see cref="StringUtility"/> class.
    /// </summary>
    public static class StringUtility
    {
        /// <summary>
        /// Capitalizes the first letter of the string.
        /// </summary>
        /// <param name="value">The string value.</param>
        /// <returns>The new string value.</returns>
        public static string CapitalizeFirstLetter(string value)
        {
            return char.ToUpper(value[0]) + value[1..];
        }
    }
}