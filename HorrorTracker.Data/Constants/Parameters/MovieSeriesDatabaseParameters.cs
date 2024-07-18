using HorrorTracker.Data.Models;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="MovieSeriesDatabaseParameters"/> class.
    /// </summary>
    public static class MovieSeriesDatabaseParameters
    {
        /// <summary>
        /// Retrieves the series parameters.
        /// </summary>
        /// <param name="series">The movie series.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> InsertMovieSeriesParameters(MovieSeries series)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(MovieSeriesParameters(series));
        }

        /// <summary>
        /// Retrieves the update movie series parameters.
        /// </summary>
        /// <param name="series">the movie series.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> UpdateMovieSeriesParameters(MovieSeries series)
        {
            var parameters = MovieSeriesParameters(series);
            parameters.Add("Id", series.Id);

            return DatabaseParametersHelper.CreateReadOnlyDictionary(parameters);
        }

        /// <summary>
        /// Creates the dictionary for the movie series parameters.
        /// </summary>
        /// <param name="series">The movie series.</param>
        /// <returns>The dictionary.</returns>
        private static Dictionary<string, object> MovieSeriesParameters(MovieSeries series)
        {
            return new Dictionary<string, object>
            {
                { "Title", series.Title },
                { "TotalTime", series.TotalTime },
                { "TotalMovies", series.TotalMovies },
                { "Watched", series.Watched }
            };
        }
    }
}