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

            return DatabaseParametersHelper.CreateReadOnlyDictionary(parameters);
        }
    }
}