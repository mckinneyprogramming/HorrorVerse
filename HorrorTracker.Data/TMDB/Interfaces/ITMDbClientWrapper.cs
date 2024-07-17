using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Data.TMDB.Interfaces
{
    /// <summary>
    /// The <see cref="ITMDbClientWrapper"/> interface.
    /// </summary>
    public interface ITMDbClientWrapper
    {
        /// <summary>
        /// Searches for a movie collection based on the movie series string.
        /// </summary>
        /// <param name="query">The query string.</param>
        /// <param name="page">The page.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The serach results.</returns>
        [ExcludeFromCodeCoverage]
        Task<SearchContainer<SearchCollection>> SearchCollectionAsync(string query, int page = 0, CancellationToken cancellationToken = default);

        /// <summary>
        /// Searchs for a movie based on the movie string.
        /// </summary>
        /// <param name="movie">The movie string.</param>
        /// <param name="page">The page.</param>
        /// <param name="includeAdult">The include adult.</param>
        /// <param name="year">The year.</param>
        /// <param name="region">The region.</param>
        /// <param name="primaryReleaseYear">The primary release year.</param>
        /// <param name="cancellationToken">the cancellation token.</param>
        /// <returns>The search results.</returns>
        [ExcludeFromCodeCoverage]
        Task<SearchContainer<SearchMovie>> SearchMovieAsync(
            string movie,
            int page = 0,
            bool includeAdult = false,
            int year = 0,
            string? region = default,
            int primaryReleaseYear = 0,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Searches for a tv show based on the tv show string.
        /// </summary>
        /// <param name="tvShowName">The TV show name.</param>
        /// <param name="page">The page.</param>
        /// <param name="includeAdult">The include adult.</param>
        /// <param name="firstAirDateYear">The first air date year.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The search results.</returns>
        [ExcludeFromCodeCoverage]
        Task<SearchContainer<SearchTv>> SearchTvShowAsync(
            string tvShowName,
            int page = 0,
            bool includeAdult = false,
            int firstAirDateYear = 0,
            CancellationToken cancellationToken = default);

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

        /// <summary>
        /// Retrieves the tv show.
        /// </summary>
        /// <param name="tvShowId">The tv show id.</param>
        /// <param name="tvShowMethods">The tv show methods.</param>
        /// <param name="language">The language.</param>
        /// <param name="includeImageLanguage">The include image language.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The tv show.</returns>
        [ExcludeFromCodeCoverage]
        Task<TvShow> GetTvShowAsync(
            int tvShowId,
            TvShowMethods tvShowMethods = TvShowMethods.Undefined,
            string? language = null,
            string? includeImageLanguage = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the tv season.
        /// </summary>
        /// <param name="tvShowId">The tv show id.</param>
        /// <param name="seasonNumber">The season number.</param>
        /// <param name="tvSeasonMethods">The tv season methods.</param>
        /// <param name="language">The language.</param>
        /// <param name="includeImageLanguage">The include image language.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The tv season.</returns>
        [ExcludeFromCodeCoverage]
        Task<TvSeason> GetTvSeasonAsync(
            int tvShowId,
            int seasonNumber,
            TvSeasonMethods tvSeasonMethods = TvSeasonMethods.Undefined,
            string? language = null,
            string? includeImageLanguage = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the tv episode.
        /// </summary>
        /// <param name="tvShowId">The tv show id.</param>
        /// <param name="seasonNumber">The season number.</param>
        /// <param name="episodeNumber">The episode number.</param>
        /// <param name="tvEpisodeMethods">The tv episode methods.</param>
        /// <param name="language">The language.</param>
        /// <param name="includeImageLanguage">The include image language.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The tv episode.</returns>
        [ExcludeFromCodeCoverage]
        Task<TvEpisode> GetTvEpisodeAsync(
            int tvShowId,
            int seasonNumber,
            int episodeNumber,
            TvEpisodeMethods tvEpisodeMethods = TvEpisodeMethods.Undefined,
            string? language = null,
            string? includeImageLanguage = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the list of horror collections.
        /// </summary>
        /// <param name="startPage">The start page.</param>
        /// <param name="endPage">The end page.</param>
        /// <param name="genreId">The genre id.</param>
        /// <returns>The hash set of collections.</returns>
        [ExcludeFromCodeCoverage]
        Task<HashSet<SearchCollection>> GetHorrorCollections(int startPage, int endPage, int genreId);

        /// <summary>
        /// Retrieves the number of pages of horror films.
        /// </summary>
        /// <param name="genreId">The genre id.</param>
        /// <returns>The total number of pages.</returns>
        [ExcludeFromCodeCoverage]
        Task<int> GetNumberOfPages(int genreId);

        /// <summary>
        /// Retrieves the movies that are not released yet.
        /// </summary>
        /// <returns>The list of movies.</returns>
        [ExcludeFromCodeCoverage]
        Task<List<SearchMovie>> GetUpcomingHorrorMoviesAsync();
    }
}