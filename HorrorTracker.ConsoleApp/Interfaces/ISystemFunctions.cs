namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="ISystemFunctions"/> interface.
    /// </summary>
    public interface ISystemFunctions
    {
        /// <summary>
        /// Delay's the task by the specified milliseconds.
        /// </summary>
        /// <param name="milliseconds">The milliseconds to delay.</param>
        /// <returns>The task.</returns>
        Task Delay(int milliseconds);

        /// <summary>
        /// Retrieves the next random integer.
        /// </summary>
        /// <returns>The random integer.</returns>
        int Next();

        /// <summary>
        /// Generates a random integer between the two numbers.
        /// </summary>
        /// <param name="minValue">The minimum value.</param>
        /// <param name="maxValue">The maximum value.</param>
        /// <returns>The random integer.</returns>
        int Next(int minValue, int maxValue);

        /// <summary>
        /// Generates a random integer from the max value.
        /// </summary>
        /// <param name="maxValue">The maximum value.</param>
        /// <returns>The random integer.</returns>
        int Next(int maxValue);

        /// <summary>
        /// Generates a random double number between 0.0 and 1.0.
        /// </summary>
        /// <returns></returns>
        double NextDouble();

        /// <summary>
        /// Generates a random character within a specific ASCII range.
        /// </summary>
        /// <param name="minAscii">Th minimum number.</param>
        /// <param name="maxAscii">The maximum number.</param>
        /// <returns>The character.</returns>
        char NextChar(int minAscii, int maxAscii);
    }
}