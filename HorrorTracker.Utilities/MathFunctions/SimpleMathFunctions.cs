using System.Numerics;

namespace HorrorTracker.Utilities.MathFunctions
{
    /// <summary>
    /// The <see cref="SimpleMathFunctions"/> class.
    /// </summary>
    public static class SimpleMathFunctions
    {
        /// <summary>
        /// Adds multiple numbers together of any numeric type.
        /// </summary>
        /// <typeparam name="T">A numeric type.</typeparam>
        /// <param name="numbers">The numbers to add.</param>
        /// <returns>The sum of the numbers.</returns>
        public static T Add<T>(params T[] numbers) where T : INumber<T>
        {
            T sum = T.Zero;
            foreach (var number in numbers)
            {
                sum += number;
            }

            return sum;
        }

        /// <summary>
        /// Divides the first number by the second number for any numeric type.
        /// </summary>
        /// <typeparam name="T">A numeric type.</typeparam>
        /// <param name="numberOne">The first number.</param>
        /// <param name="numberTwo">The second number.</param>
        /// <returns>The division of the numbers.</returns>
        public static T Divide<T>(T numberOne, T numberTwo) where T : INumber<T>
        {
            if (numberTwo == T.Zero)
            {
                throw new DivideByZeroException("Attempted to divide by zero.");
            }

            return numberOne / numberTwo;
        }
    }
}