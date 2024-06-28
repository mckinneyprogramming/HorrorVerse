using HorrorTracker.Data.TMDB.Interfaces;
using TMDbLib.Client;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="TMDbClientWrapper"/> class.
    /// </summary>
    public class TMDbClientWrapper : ITMDbClientWrapper
    {
        /// <summary>
        /// The TMDbClient.
        /// </summary>
        private readonly TMDbClient _client;

        /// <summary>
        /// Initializes a new instance of the <see cref="TMDbClientWrapper"/> class.
        /// </summary>
        /// <param name="apiKey">The API key.</param>
        public TMDbClientWrapper(string? apiKey)
        {
            _client = new TMDbClient(apiKey);
        }

        /// <inheritdoc/>
        public async Task<SearchContainer<SearchCollection>> SearchCollectionAsync(string query, int page = 0, CancellationToken cancellationToken = default)
        {
            return await _client.SearchCollectionAsync(query, page, cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<Collection> GetCollectionAsync(int collectionId, CollectionMethods methods = CollectionMethods.Images, CancellationToken cancellationToken = default)
        {
            return await _client.GetCollectionAsync(collectionId, methods, cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<Movie> GetMovieAsync(int movieId, MovieMethods appendToResponse = MovieMethods.Undefined, CancellationToken cancellationToken = default)
        {
            return await _client.GetMovieAsync(movieId, appendToResponse, cancellationToken);
        }
    }
}