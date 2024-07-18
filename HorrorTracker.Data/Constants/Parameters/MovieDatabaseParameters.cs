using HorrorTracker.Data.Models;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="MovieDatabaseParameters"/> class.
    /// </summary>
    public static class MovieDatabaseParameters
    {
        /// <summary>
        /// The parameters for inserting movie into a database.
        /// </summary>
        /// <param name="movie">The movie.</param>
        /// <returns>The parameters dictionary.</returns>
        public static ReadOnlyDictionary<string, object> InsertMovieParameters(Movie movie)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(Parameters(movie));
        }

        /// <summary>
        /// Retrieves the update movie series parameters.
        /// </summary>
        /// <param name="movie">the movie series.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> UpdateMovieParameters(Movie movie)
        {
            var parameters = Parameters(movie);
            parameters.Add("Id", movie.Id);

            return DatabaseParametersHelper.CreateReadOnlyDictionary(parameters);
        }

        /// <summary>
        /// Creates the movie parameters.
        /// </summary>
        /// <param name="movie">The movie.</param>
        /// <returns>The parameters dictionary.</returns>
        private static Dictionary<string, object> Parameters(Movie movie)
        {
            var parameters = new Dictionary<string, object>
            {
                { "Title", movie.Title },
                { "TotalTime", movie.TotalTime },
                { "PartOfSeries", movie.PartOfSeries },
                { "ReleaseYear", movie.ReleaseYear },
                { "Watched", movie.Watched }
            };

            if (movie.SeriesId.HasValue)
            {
                parameters.Add("SeriesId", movie.SeriesId.Value);
            }

            return parameters;
        }
    }
}