using HorrorTracker.Data.TMDB.Interfaces;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="MovieDatabaseConfig"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class MovieDatabaseConfig : IMovieDatabaseConfiguration
    {
        /// <inheritdoc/>
        public string? GetApiKey()
        {
            return Environment.GetEnvironmentVariable("TMDBKey");
        }
    }
}