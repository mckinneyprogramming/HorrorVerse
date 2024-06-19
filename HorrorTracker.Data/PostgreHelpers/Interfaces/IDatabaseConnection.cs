namespace HorrorTracker.Data.PostgreHelpers.Interfaces
{
    /// <summary>
    /// The <see cref="IDatabaseConnection"/> interface.
    /// </summary>
    public interface IDatabaseConnection
    {
        /// <summary>
        /// Opens the connection to the database.
        /// </summary>
        void Open();

        /// <summary>
        /// Closes the connection to the database.
        /// </summary>
        void Close();

        /// <summary>
        /// Creates the command for the database.
        /// </summary>
        /// <returns>Creates the command.</returns>
        IDatabaseCommand CreateCommand();
    }
}