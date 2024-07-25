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
        /// <param name="watchedMovies">Watched or unwatched movies.</param>
        /// <returns>The list of movies.</returns>
        IEnumerable<Movie> GetUnwatchedOrWatchedMovies(bool watchedMovies);

        /// <summary>
        /// Retrieves the time of the specified query.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <returns>The time.</returns>
        decimal GetTime(string query);

        /// <summary>
        /// Retrieves the unwatched or watched movies in a given series.
        /// </summary>
        /// <param name="watchedMovies">Retrieving watched movies.</param>
        /// <param name="seriesTitle">The series title.</param>
        /// <returns>The list of movies.</returns>
        IEnumerable<Movie> GetUnwatchedOrWatchedMoviesInSeries(bool watchedMovies, string seriesTitle);
    }
}