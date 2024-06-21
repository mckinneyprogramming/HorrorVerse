using HorrorTracker.Data.TMDB.Interfaces;
using System.Configuration;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="MovieDatabseConfig"/> class.
    /// </summary>
    public class MovieDatabseConfig : IMovieDatabaseConfiguration
    {
        /// <inheritdoc/>
        public string? GetApiKey()
        {
            return ConfigurationManager.AppSettings["TMDBKey"];
        }
    }
}