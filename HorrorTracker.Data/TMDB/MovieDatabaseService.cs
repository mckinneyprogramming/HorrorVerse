using HorrorTracker.Data.TMDB.Interfaces;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

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
        private readonly ITMDbClientWrapper _client;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieDatabaseService"/> class.
        /// </summary>
        public MovieDatabaseService(ITMDbClientWrapper client)
        {
            _client = client;
        }

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
        /// Retrieves a list of movies in the TMDB API.
        /// </summary>
        /// <param name="movieName">The movie name.</param>
        /// <returns>The list of movies.</returns>
        public async Task<SearchContainer<SearchMovie>> SearchMovie(string movieName)
        {
            return await _client.SearchMovieAsync(movieName);
        }

        /// <summary>
        /// Retrieves a list of TV shows in the TMDB API.
        /// </summary>
        /// <param name="tvShow">The TV show.</param>
        /// <returns>The list of TV shows.</returns>
        public async Task<SearchContainer<SearchTv>> SearchTvShow(string tvShow)
        {
            return await _client.SearchTvShowAsync(tvShow);
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

        /// <summary>
        /// Retrieves the TV show in TMDB API.
        /// </summary>
        /// <param name="tvShowId">The tv show id.</param>
        /// <returns>The TV show.</returns>
        public async Task<TvShow> GetTvShow(int tvShowId)
        {
            return await _client.GetTvShowAsync(tvShowId);
        }

        /// <summary>
        /// Retrieves the TV season in TMDB API.
        /// </summary>
        /// <param name="tvShowId">The TV show id.</param>
        /// <param name="seasonNumber">The season number.</param>
        /// <returns>The TV season.</returns>
        public async Task<TvSeason> GetTvSeason(int tvShowId, int seasonNumber)
        {
            return await _client.GetTvSeasonAsync(tvShowId, seasonNumber);
        }

        /// <summary>
        /// Retrieves the TV episode in TMDB API.
        /// </summary>
        /// <param name="tvShowId">The TV show id.</param>
        /// <param name="seasonNumber">The season number.</param>
        /// <param name="episodeNumber">The episode number.</param>
        /// <returns>The TV episode.</returns>
        public async Task<TvEpisode> GetTvEpisode(int tvShowId, int seasonNumber, int episodeNumber)
        {
            return await _client.GetTvEpisodeAsync(tvShowId, seasonNumber, episodeNumber);
        }
    }
}