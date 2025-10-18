using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Core
{
    /// <summary>
    /// Provides the entry point for the application.
    /// </summary>
    /// <remarks>
    /// The Main method initializes essential services and components before starting the main
    /// program logic. It is typically invoked automatically when the application is launched.
    /// </remarks>
    [ExcludeFromCodeCoverage]
    static class Entry
    {
        /// <summary>
        /// Serves as the entry point for the application.
        /// </summary>
        /// <remarks>
        /// This method initializes required services and components, then starts the main
        /// program logic. It is typically called automatically when the application is launched.
        /// </remarks>
        static void Main()
        {
            Bootstrapper.Start();
        }
    }
}