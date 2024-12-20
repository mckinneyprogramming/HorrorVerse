namespace HorrorTracker.Utilities.MathFunctions
{
    /// <summary>
    /// The <see cref="SimpleMathFunctions"/> class.
    /// </summary>
    public static class SimpleMathFunctions
    {
        /// <summary>
        /// Adds two numbers together.
        /// </summary>
        /// <param name="numberOne">The first number.</param>
        /// <param name="numberTwo">The second number.</param>
        /// <returns>The sum of the numbers.</returns>
        public static decimal Add(decimal numberOne, decimal numberTwo)
        {
            return numberOne + numberTwo;
        }

        /// <summary>
        /// Divides the first number with the second number.
        /// </summary>
        /// <param name="numberOne">The first number.</param>
        /// <param name="numberTwo">The second number.</param>
        /// <returns>The division of the numbers.</returns>
        public static decimal Divide(decimal numberOne, decimal numberTwo)
        {
            try
            {
                return numberOne / numberTwo;
            }
            catch (DivideByZeroException ex)
            {
                throw new DivideByZeroException(ex.Message);
            }
        }
    }
}