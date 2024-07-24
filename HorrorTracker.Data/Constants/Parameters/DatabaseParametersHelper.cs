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
                parameters.Add("TotalTime", series.TotalTime);
                parameters.Add("TotalMovies", series.TotalMovies);
                parameters.Add("Watched", series.Watched);
            }
            else if (item is Movie movie)
            {
                parameters.Add("TotalTime", movie.TotalTime);
                parameters.Add("PartOfSeries", movie.PartOfSeries);
                parameters.Add("ReleaseYear", movie.ReleaseYear);
                parameters.Add("Watched", movie.Watched);

                if (movie.SeriesId.HasValue)
                {
                    parameters.Add("SeriesId", movie.SeriesId.Value);
                }
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
    }
}