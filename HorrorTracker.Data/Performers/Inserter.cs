using HorrorTracker.Data.Models;
using HorrorTracker.Data.Repositories.Interfaces;

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
        public static bool MovieSeriesAddedSuccessfully(IMovieSeriesRepository repository, MovieSeries series)
        {
            var movieSeriesAlreadyExists = repository.GetMovieSeriesByName(series.Title);
            if (movieSeriesAlreadyExists != null)
            {
                return false;
            }

            var success = repository.AddMovieSeries(series);
            return success != 0;
        }

        /// <summary>
        /// Adds a movie to the database.
        /// </summary>
        /// <param name="repository">The movie repository.</param>
        /// <param name="movie">The movie.</param>
        /// <returns>True if the movie is added successfully; false otherwise.</returns>
        public static bool MovieAddedSuccessfully(IMovieRepository repository, Movie movie)
        {
            var addMovieResult = repository.AddMovie(movie);
            return addMovieResult != 0;
        }
    }
}