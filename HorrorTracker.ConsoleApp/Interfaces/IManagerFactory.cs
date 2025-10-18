using HorrorTracker.ConsoleApp.Managers;

namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="IManagerFactory"/> interface.
    /// </summary>
    public interface IManagerFactory
    {
        /// <summary>
        /// Creates the <see cref="MovieDatabaseApiManager"/> object.
        /// </summary>
        /// <returns>The <see cref="MovieDatabaseApiManager"/> object.</returns>
        MovieDatabaseApiManager CreateMovieDatabaseApiManager();

        /// <summary>
        /// Creates the <see cref="ManualManager"/> object.
        /// </summary>
        /// <returns>The <see cref="ManualManager"/> object.</returns>
        ManualManager CreateManualManager();

        /// <summary>
        /// Creates the <see cref="AccountManager"/> object.
        /// </summary>
        /// <returns>The <see cref="AccountManager"/> object.</returns>
        AccountManager CreateAccountManager();
    }
}