using System.Configuration;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="MovieDatabseConfig"/> class.
    /// </summary>
    public static class MovieDatabseConfig
    {
        /// <summary>
        /// The API Key to TMDB.
        /// </summary>
        public static string ApiKey => ConfigurationManager.AppSettings["TMDBKey"];
    }
}