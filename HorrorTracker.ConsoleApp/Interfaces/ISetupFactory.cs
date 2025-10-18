using HorrorTracker.ConsoleApp.Core;

namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="ISetupFactory"/> interface.
    /// </summary>
    public interface ISetupFactory
    {
        /// <summary>
        /// Creates the core setup.
        /// </summary>
        /// <returns>The core setup.</returns>
        CoreSetup CreateCoreSetup();

        /// <summary>
        /// Creates the core menu setup.
        /// </summary>
        /// <param name="coreSetup">The core setup instance.</param>
        /// <returns>The core menu setup.</returns>
        CoreMenuSetup CreateCoreMenuSetup(CoreSetup coreSetup);
    }
}