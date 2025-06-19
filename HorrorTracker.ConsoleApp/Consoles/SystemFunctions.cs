using HorrorTracker.ConsoleApp.Interfaces;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Consoles
{
    /// <summary>
    /// The <see cref="SystemFunctions"/> class.
    /// </summary>
    /// <seealso cref="ISystemFunctions"/>
    [ExcludeFromCodeCoverage]
    public class SystemFunctions : ISystemFunctions
    {
        private readonly Random _random = new();

        /// <inheritdoc/>
        public Task Delay(int milliseconds) => Task.Delay(milliseconds);

        /// <inheritdoc/>
        public int Next() => _random.Next();

        /// <inheritdoc/>
        public int Next(int minValue, int maxValue) => _random.Next(minValue, maxValue);

        /// <inheritdoc/>
        public int Next(int maxValue) => _random.Next(maxValue);

        /// <inheritdoc/>
        public char NextChar(int minAscii, int maxAscii) => (char)_random.Next(minAscii, maxAscii + 1);

        /// <inheritdoc/>
        public double NextDouble() => _random.NextDouble();
    }
}