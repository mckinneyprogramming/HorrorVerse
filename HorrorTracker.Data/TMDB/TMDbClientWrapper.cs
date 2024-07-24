using HorrorTracker.Data.TMDB.Interfaces;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Client;
using TMDbLib.Objects.Authentication;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Lists;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="TMDbClientWrapper"/> class.
    /// </summary>
    /// <seealso cref="ITMDbClientWrapper"/>
    [ExcludeFromCodeCoverage]
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
        public async Task<SearchContainer<AccountList>> GetLists()
        {
            var sessionId = Environment.GetEnvironmentVariable("TMDbAccountSessionId");
            await _client.SetSessionInformationAsync(sessionId, SessionType.UserSession);
            var lists = _client.AccountGetListsAsync().Result;
            return lists;
        }

        /// <inheritdoc/>
        public async Task<SearchContainer<SearchCollection>> SearchCollectionAsync(string query, int page = 0, CancellationToken cancellationToken = default)
        {
            return await _client.SearchCollectionAsync(query, page, cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<SearchContainer<SearchMovie>> SearchMovieAsync(
            string movie,
            int page = 0,
            bool includeAdult = false,
            int year = 0,
            string? region = default,
            int primaryReleaseYear = 0,
            CancellationToken cancellationToken = default)
        {
            return await _client.SearchMovieAsync(movie, page, includeAdult, year, region, primaryReleaseYear, cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<SearchContainer<SearchTv>> SearchTvShowAsync(
            string tvShowName,
            int page = 0,
            bool includeAdult = false,
            int firstAirDateYear = 0,
            CancellationToken cancellationToken = default)
        {
            return await _client.SearchTvShowAsync(tvShowName, cancellationToken: cancellationToken);
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

        /// <inheritdoc/>
        public async Task<TvShow> GetTvShowAsync(
            int tvShowId,
            TvShowMethods tvShowMethods = TvShowMethods.Undefined,
            string? language = null,
            string? includeImageLanguage = null,
            CancellationToken cancellationToken = default)
        {
            return await _client.GetTvShowAsync(tvShowId, cancellationToken: cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<TvSeason> GetTvSeasonAsync(
            int tvShowId,
            int seasonNumber,
            TvSeasonMethods tvSeasonMethods = TvSeasonMethods.Undefined,
            string? language = null,
            string? includeImageLanguage = null,
            CancellationToken cancellationToken = default)
        {
            return await _client.GetTvSeasonAsync(tvShowId, seasonNumber, cancellationToken: cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<TvEpisode> GetTvEpisodeAsync(
            int tvShowId,
            int seasonNumber,
            int episodeNumber,
            TvEpisodeMethods tvEpisodeMethods = TvEpisodeMethods.Undefined,
            string? language = null,
            string? includeImageLanguage = null,
            CancellationToken cancellationToken = default)
        {
            return await _client.GetTvEpisodeAsync(tvShowId, seasonNumber, episodeNumber, cancellationToken: cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<HashSet<SearchCollection>> GetHorrorCollections(int startPage, int endPage, int genreId)
        {
            var page = startPage;
            var uniqueCollections = new HashSet<SearchCollection>(new CollectionComparer());
            var delayBetweenRequestsMs = 200;

            while (page <= endPage)
            {
                var helper = new TMDbClientWrapperHelper(_client);
                var movies = await helper.QueryMoviesAsync(page, genreId);
                var fetchTasks = helper.RetrieveTasks(movies, 50);
                await helper.AddCollectionsToList(uniqueCollections, fetchTasks);

                page++;
                await Task.Delay(delayBetweenRequestsMs);

                if (page > movies.TotalPages) break;
            }

            return uniqueCollections;
        }

        /// <inheritdoc>
        public async Task<int> GetNumberOfPages(int genreId)
        {
            var genreIds = new[] { genreId };
            var movies = await _client.DiscoverMoviesAsync()
                                     .IncludeWithAllOfGenre(genreIds)
                                     .Query();
            return movies.TotalPages;
        }

        /// <inheritdoc>
        public async Task<List<SearchMovie>> GetUpcomingHorrorMoviesAsync()
        {
            var genreIds = new[] { 27 };
            var currentDate = DateTime.Now;
            var allMovies = new List<SearchMovie>();
            int pageNumber = 1;
            int totalPages;

            do
            {
                var helper = new TMDbClientWrapperHelper(_client);
                var searchContainer = await helper.RetrieveUpcomingMoviesSearchContainer(genreIds, currentDate, allMovies, pageNumber);
                totalPages = searchContainer.TotalPages;
                pageNumber++;

            } while (pageNumber <= totalPages);

            return allMovies;
        }
    }
}