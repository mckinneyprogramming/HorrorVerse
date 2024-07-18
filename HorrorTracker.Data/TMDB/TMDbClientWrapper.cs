using HorrorTracker.Data.TMDB.Interfaces;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Client;
using TMDbLib.Objects.Account;
using TMDbLib.Objects.Authentication;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.Discover;
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
                var movies = await QueryMoviesAsync(page, genreId);
                var fetchTasks = RetrieveTasks(movies, 50);
                await AddCollectionsToList(uniqueCollections, fetchTasks);

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
                var searchContainer = await _client.DiscoverMoviesAsync()
                                                   .WherePrimaryReleaseDateIsAfter(currentDate)
                                                   .IncludeWithAllOfGenre(genreIds)
                                                   .OrderBy(DiscoverMovieSortBy.PrimaryReleaseDate)
                                                   .Query(pageNumber);

                if (searchContainer.Results != null)
                {
                    allMovies.AddRange(searchContainer.Results);
                }

                totalPages = searchContainer.TotalPages;
                pageNumber++;

            } while (pageNumber <= totalPages);

            return allMovies;
        }

        /// <summary>
        /// Queries through the discover movies and returns the container of movies.
        /// </summary>
        /// <param name="page">The page number.</param>
        /// <returns>The search container.</returns>
        private async Task<SearchContainer<SearchMovie>> QueryMoviesAsync(int page, int genreId)
        {
            var genreIds = new[] { genreId };
            return await _client.DiscoverMoviesAsync()
                                .IncludeWithAllOfGenre(genreIds)
                                .Query(page);
        }

        /// <summary>
        /// Retrieves the tasks to fetching the movie details.
        /// </summary>
        /// <param name="movies">The search container of movies.</param>
        /// <param name="batchSize">The batch size.</param>
        /// <returns>The list of movie tasks.</returns>
        private List<Task<Movie>> RetrieveTasks(SearchContainer<SearchMovie> movies, int batchSize)
        {
            return movies.Results.Take(batchSize)
                          .Select(movie => FetchMovieDetailsAsync(movie.Id))
                          .ToList();
        }

        /// <summary>
        /// Retrieves the movie details.
        /// </summary>
        /// <param name="movieId">The movie id.</param>
        /// <returns>The movie.</returns>
        private async Task<Movie> FetchMovieDetailsAsync(int movieId)
        {
            try
            {
                return await _client.GetMovieAsync(movieId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching movie details for ID {movieId}: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Adds the movie series to a list.
        /// </summary>
        /// <param name="uniqueCollections">The set of series.</param>
        /// <param name="fetchTasks">The list of movie tasks.</param>
        /// <returns>The task.</returns>
        private static async Task AddCollectionsToList(HashSet<SearchCollection> uniqueCollections, List<Task<Movie>> fetchTasks)
        {
            var fetchedMovies = await Task.WhenAll(fetchTasks);
            foreach (var detailedMovie in fetchedMovies.Where(m => m.BelongsToCollection != null))
            {
                uniqueCollections.Add(detailedMovie.BelongsToCollection);
            }
        }
    }
}