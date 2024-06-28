using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Data.TMDB.Interfaces
{
    /// <summary>
    /// The <see cref="ITMDbClientWrapper"/> interface.
    /// </summary>
    public interface ITMDbClientWrapper
    {
        /// <summary>
        /// Searches for a movie collection based on the query.
        /// </summary>
        /// <param name="query">The query string.</param>
        /// <param name="page">The page.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The serach results.</returns>
        [ExcludeFromCodeCoverage]
        Task<SearchContainer<SearchCollection>> SearchCollectionAsync(string query, int page = 0, CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the movie collection.
        /// </summary>
        /// <param name="collectionId">The collection id.</param>
        /// <param name="methods">The colletion methods.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The movie collection.</returns>
        [ExcludeFromCodeCoverage]
        Task<Collection> GetCollectionAsync(int collectionId, CollectionMethods methods = CollectionMethods.Images, CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the movie.
        /// </summary>
        /// <param name="movieId">The movie id.</param>
        /// <param name="appendToResponse">The movie methods.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The movie.</returns>
        [ExcludeFromCodeCoverage]
        Task<Movie> GetMovieAsync(int movieId, MovieMethods appendToResponse = MovieMethods.Undefined, CancellationToken cancellationToken = default);
    }
}