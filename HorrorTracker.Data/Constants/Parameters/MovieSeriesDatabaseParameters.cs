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
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "Title", series.Title },
                { "TotalTime", series.TotalTime },
                { "TotalMovies", series.TotalMovies },
                { "Watched", series.Watched }
            });
        }

        /// <summary>
        /// Retrievs the get movie series parameters.
        /// </summary>
        /// <param name="seriesTitle">The series title.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> GetMovieSeriesParameters(string seriesTitle)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "@Title", seriesTitle }
            });
        }

        /// <summary>
        /// Retrieves the update movie series parameters.
        /// </summary>
        /// <param name="series">the movie series.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> UpdateMovieSeriesParameters(MovieSeries series)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "Title", series.Title },
                { "TotalTime", series.TotalTime },
                { "TotalMovies", series.TotalMovies },
                { "Watched", series.Watched },
                { "Id", series.Id }
            });
        }
    }
}