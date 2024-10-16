using HorrorTracker.Data.Models;
using HorrorTracker.Data.Models.Bases;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="DatabaseParametersHelper"/> class.
    /// </summary>
    public static class DatabaseParametersHelper
    {
        /// <summary>
        /// Creates the object parameters.
        /// </summary>
        /// <param name="item">The horror object.</param>
        /// <returns>The parameter dictionary.</returns>
        public static Dictionary<string, object> CreateHorrorObjectParameters(HorrorBase item)
        {
            var parameters = new Dictionary<string, object>
            {
                { "Title", item.Title }
            };

            if (item is MovieSeries series)
            {
                MovieSeriesParameters(parameters, series);
            }
            else if (item is Movie movie)
            {
                MovieParameters(parameters, movie);
            }

            return parameters;
        }

        /// <summary>
        /// Helper method to create a read-only dictionary from a regular dictionary.
        /// </summary>
        /// <param name="dictionary">The dictionary to convert.</param>
        /// <returns>The read-only dictionary.</returns>
        public static ReadOnlyDictionary<string, object> CreateReadOnlyDictionary(Dictionary<string, object> dictionary)
        {
            return new ReadOnlyDictionary<string, object>(dictionary);
        }

        /// <summary>
        /// Adds the remainder of the movie series parameters.
        /// </summary>
        /// <param name="parameters">The parameters.</param>
        /// <param name="series">The movie series.</param>
        private static void MovieSeriesParameters(Dictionary<string, object> parameters, MovieSeries series)
        {
            VisualBaseObjectParameters(parameters, series);
            parameters.Add("TotalMovies", series.TotalMovies);
        }

        /// <summary>
        /// Adds the remainder of the movie parameters.
        /// </summary>
        /// <param name="parameters">The parameters.</param>
        /// <param name="movie">The movie.</param>
        private static void MovieParameters(Dictionary<string, object> parameters, Movie movie)
        {
            VisualBaseObjectParameters(parameters, movie);
            parameters.Add("PartOfSeries", movie.PartOfSeries);
            parameters.Add("ReleaseYear", movie.ReleaseYear);

            if (movie.SeriesId.HasValue)
            {
                parameters.Add("SeriesId", movie.SeriesId.Value);
            }
            else
            {
                parameters.Add("SeriesId", DBNull.Value);
            }
        }

        /// <summary>
        /// The total time and watched parameters.
        /// </summary>
        /// <param name="parameters">The parameters.</param>
        /// <param name="item">The object.</param>
        private static void VisualBaseObjectParameters(Dictionary<string, object> parameters, VisualBase item)
        {
            parameters.Add("TotalTime", item.TotalTime);
            parameters.Add("Watched", item.Watched);
        }
    }
}