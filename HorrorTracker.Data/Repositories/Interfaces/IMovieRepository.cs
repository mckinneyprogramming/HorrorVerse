using HorrorTracker.Data.Models;

namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IMovieRepository"/> interface.
    /// </summary>
    public interface IMovieRepository
    {
        /// <summary>
        /// Retrieves the list of unwatched or watched movies.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <returns>The list of movies.</returns>
        IEnumerable<Movie> GetUnwatchedOrWatchedMovies(string query);
    }
}