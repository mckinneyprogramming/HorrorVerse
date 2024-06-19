using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.ConsoleHelpers
{
    /// <summary>
    /// The <see cref="ConsoleTitles"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public static class ConsoleTitles
    {
        /// <summary>
        /// The base title.
        /// </summary>
        private const string BaseTitle = "Horror Tracker -";

        /// <summary>
        /// Retrieves the console title.
        /// </summary>
        /// <param name="subtitle">The subtitle.</param>
        /// <returns>The title.</returns>
        public static string RetrieveTitle(string subtitle)
        {
            return $"{BaseTitle} {subtitle}";
        }
    }
}