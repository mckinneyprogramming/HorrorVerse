using TMDbLib.Client;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="MovieDatabaseService"/>
    /// </summary>
    public class MovieDatabaseService
    {
        /// <summary>
        /// The TMDB client.
        /// </summary>
        private readonly TMDbClient _client;

        /// <summary>
        /// The movie database configuration.
        /// </summary>
        private readonly MovieDatabseConfig _movieDatabaseConfiguration;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieDatabaseService"/> class.
        /// </summary>
        public MovieDatabaseService()
        {
            _movieDatabaseConfiguration = new MovieDatabseConfig();
            _client = new TMDbClient(ApiKey);
        }

        /// <summary>
        /// The API Key.
        /// </summary>
        public string? ApiKey => _movieDatabaseConfiguration.GetApiKey();

        /// <summary>
        /// Retrieves a list of collections in TMDB API.
        /// </summary>
        /// <param name="seriesTitle">The series title.</param>
        /// <returns>The list of collections.</returns>
        public async Task<SearchContainer<SearchCollection>> SearchCollection(string seriesTitle)
        {
            return await _client.SearchCollectionAsync(seriesTitle);
        }

        /// <summary>
        /// Retrieves a collection in TMDB API.
        /// </summary>
        /// <param name="seriesId">The series id.</param>
        /// <returns>The collection.</returns>
        public async Task<Collection> GetCollection(int seriesId)
        {
            return await _client.GetCollectionAsync(seriesId);
        }

        /// <summary>
        /// Retrieves a movie in TMDB API.
        /// </summary>
        /// <param name="movieId">The movie id.</param>
        /// <returns>The movie.</returns>
        public async Task<Movie> GetMovie(int movieId)
        {
            return await _client.GetMovieAsync(movieId);
        }
    }
}