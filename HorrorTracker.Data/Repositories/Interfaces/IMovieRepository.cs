using HorrorTracker.Data.Models;

namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IMovieRepository"/> interface.
    /// </summary>
    public interface IMovieRepository
    {
        /// <summary>
        /// Inserts a movie into the database.
        /// </summary>
        /// <param name="movie">The movie.</param>
        /// <returns>The result.</returns>
        int AddMovie(Movie movie);
    }
}