namespace HorrorTracker.Data.TMDB.Interfaces
{
    /// <summary>
    /// The <see cref="IMovieDatabaseConfiguration"/> interface.
    /// </summary>
    public interface IMovieDatabaseConfiguration
    {
        /// <summary>
        /// Retrieves the API key to TMDB.
        /// </summary>
        /// <returns>The API Key.</returns>
        string? GetApiKey();
    }
}