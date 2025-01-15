using System.Diagnostics.CodeAnalysis;
using TMDbLib.Client;
using TMDbLib.Objects.Discover;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Data.TMDB
{
    /// <summary>
    /// The <see cref="TMDbClientWrapperHelper"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="TMDbClientWrapperHelper"/> class.
    /// </remarks>
    /// <param name="client">The client.</param>
    [ExcludeFromCodeCoverage]
    public class TMDbClientWrapperHelper(TMDbClient client)
    {
        /// <summary>
        /// The TMDbClient.
        /// </summary>
        private readonly TMDbClient _client = client;

        /// <summary>
        /// Queries through the discover movies and returns the container of movies.
        /// </summary>
        /// <param name="page">The page number.</param>
        /// <returns>The search container.</returns>
        public async Task<SearchContainer<SearchMovie>> QueryMoviesAsync(int page, int genreId)
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
        public List<Task<Movie>> RetrieveTasks(SearchContainer<SearchMovie> movies, int batchSize)
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
        public async Task<Movie> FetchMovieDetailsAsync(int movieId)
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
        public static async Task AddCollectionsToList(HashSet<SearchCollection> uniqueCollections, List<Task<Movie>> fetchTasks)
        {
            var fetchedMovies = await Task.WhenAll(fetchTasks);
            foreach (var detailedMovie in fetchedMovies.Where(m => m.BelongsToCollection != null))
            {
                uniqueCollections.Add(detailedMovie.BelongsToCollection);
            }
        }

        /// <summary>
        /// Retrieves the search container of the upcoming horror films.
        /// </summary>
        /// <param name="genreIds">The genre ids.</param>
        /// <param name="currentDate">The current date.</param>
        /// <param name="allMovies">All the movies.</param>
        /// <param name="pageNumber">The page number.</param>
        /// <returns>The search container of search movies.</returns>
        public async Task<SearchContainer<SearchMovie>> RetrieveUpcomingMoviesSearchContainer(int[] genreIds, DateTime currentDate, List<SearchMovie> allMovies, int pageNumber)
        {
            // TODO: Add ReleaseDateBefore to query to handle stopping at a certain date.
            var searchContainer = await _client.DiscoverMoviesAsync()
                                            .WherePrimaryReleaseDateIsAfter(currentDate)
                                            .IncludeWithAllOfGenre(genreIds)
                                            .OrderBy(DiscoverMovieSortBy.PrimaryReleaseDate)
                                            .Query(pageNumber);

            if (searchContainer.Results != null)
            {
                allMovies.AddRange(searchContainer.Results);
            }

            return searchContainer;
        }
    }
}