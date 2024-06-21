namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IOverallRepository"/> interface.
    /// </summary>
    public interface IOverallRepository
    {
        /// <summary>
        /// Retrieves the overall time of the items in the database.
        /// </summary>
        /// <returns>The overall time.</returns>
        decimal GetOverallTime();

        /// <summary>
        /// Retrieves the overall time left of the items not watched in the database.
        /// </summary>
        /// <returns>The overall time left.</returns>
        decimal GetOverallTimeLeft();
    }
}