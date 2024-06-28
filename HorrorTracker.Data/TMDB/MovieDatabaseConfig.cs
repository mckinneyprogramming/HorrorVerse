using HorrorTracker.Data.TMDB.Interfaces;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="MovieDatabaseConfig"/> class.
    /// </summary>
    public class MovieDatabaseConfig : IMovieDatabaseConfiguration
    {
        /// <inheritdoc/>
        public string? GetApiKey()
        {
            return Environment.GetEnvironmentVariable("TMDBKey");
        }
    }
}