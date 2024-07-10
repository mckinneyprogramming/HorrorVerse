using HorrorTracker.Data.TMDB.Interfaces;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Client;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
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
        public async Task<HashSet<SearchCollection>> GetHorrorCollections(int startPage, int endPage)
        {
            var genreIds = new[] { 27 };
            var page = startPage;
            SearchContainer<SearchMovie> movies;
            var uniqueCollections = new HashSet<SearchCollection>(new CollectionComparer());
            var batchSize = 50;
            var delayBetweenRequestsMs = 200;

            do
            {
                movies = await _client.DiscoverMoviesAsync()
                                     .IncludeWithAllOfGenre(genreIds)
                                     .Query(page);

                List<Task<Movie>> fetchTasks = [];

                foreach (var movie in movies.Results.Take(batchSize))
                {
                    fetchTasks.Add(FetchMovieDetailsAsync(movie.Id));
                }

                var fetchedMovies = await Task.WhenAll(fetchTasks);
                foreach (var detailedMovie in fetchedMovies)
                {
                    if (detailedMovie.BelongsToCollection != null)
                    {
                        uniqueCollections.Add(detailedMovie.BelongsToCollection);
                    }
                }
                
                page++;
                await Task.Delay(delayBetweenRequestsMs);

            } while (movies.Page < endPage && page <= movies.TotalPages);

            return uniqueCollections;
        }

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
    }
}