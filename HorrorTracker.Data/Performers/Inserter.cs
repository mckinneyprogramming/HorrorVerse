using HorrorTracker.Data.Models;
using HorrorTracker.Data.Repositories.Abstractions;

namespace HorrorTracker.Data.Performers
{
    /// <summary>
    /// The <see cref="Inserter"/> class.
    /// </summary>
    public static class Inserter
    {
        /// <summary>
        /// Adds a movie series to the database.
        /// </summary>
        /// <param name="repository">The movie series repository.</param>
        /// <param name="series">The movie series.</param>
        /// <returns>True if adding was successful; false otherwise.</returns>
        public static bool MovieSeriesAddedSuccessfully(RepositoryBase<MovieSeries> repository, MovieSeries series)
        {
            var movieSeriesAlreadyExists = repository.GetByName(series.Title);
            if (movieSeriesAlreadyExists != null)
            {
                return false;
            }

            var success = repository.Add(series);
            return success != 0;
        }

        /// <summary>
        /// Adds a movie to the database.
        /// </summary>
        /// <param name="repository">The movie repository.</param>
        /// <param name="movie">The movie.</param>
        /// <returns>True if the movie is added successfully; false otherwise.</returns>
        public static bool MovieAddedSuccessfully(RepositoryBase<Movie> repository, Movie movie)
        {
            var addMovieResult = repository.Add(movie);
            return addMovieResult != 0;
        }
    }
}