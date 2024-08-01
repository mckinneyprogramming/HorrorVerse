using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IVisualBaseRepository{T}"/> interface.
    /// </summary>
    /// <typeparam name="T">The visual base object.</typeparam>
    public interface IVisualBaseRepository<T> where T : VisualBase
    {
        /// <summary>
        /// Retrieves a list of unwatched or watched items.
        /// </summary>
        /// <param name="watched">Watched or unwatched items.</param>
        /// <returns>List of items.</returns>
        IEnumerable<T> GetUnwatchedOrWatched(bool watched);

        /// <summary>
        /// Retrieves the time based on the query.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <returns>The time.</returns>
        decimal GetTime(string query);
    }
}