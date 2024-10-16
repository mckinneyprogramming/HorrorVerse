using HorrorTracker.Data.Models;

namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IMovieRepository"/> interface.
    /// </summary>
    /// <see cref="IVisualBaseRepository{T}"/>
    public interface IMovieRepository : IVisualBaseRepository<Movie>
    {
        /// <summary>
        /// Retrieves the unwatched or watched movies in a given series.
        /// </summary>
        /// <param name="watchedMovies">Retrieving watched movies.</param>
        /// <param name="seriesTitle">The series title.</param>
        /// <returns>The list of movies.</returns>
        IEnumerable<Movie> GetUnwatchedOrWatchedMoviesInSeries(bool watchedMovies, string seriesTitle);
    }
}