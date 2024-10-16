using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Models.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Constants;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieRepository"/> class.
    /// </summary>
    /// <seealso cref="RepositoryBase{T}"/>
    /// <seealso cref="IMovieRepository"/>
    /// <seealso cref="IVisualBaseRepository{T}"/>
    public class MovieRepository : RepositoryBase<Movie>, IMovieRepository
    {
        /// <summary>
        /// The Movie string.
        /// </summary>
        private const string Movie = "Movie";

        /// <summary>
        /// The movies string.
        /// </summary>
        private const string Movies = "movies";

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeriesRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public MovieRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
            : base(databaseConnection, logger)
        {
        }

        /// <inheritdoc/>
        public override int Add(Movie movie)
        {
            return ExecuteNonQuery(
                MovieQueries.InsertMovie,
                HorrorObjectsParameters.InsertParameters(movie),
                RepositoryMessages.AddSuccess($"{Movie} '{movie.Title}'"),
                RepositoryMessages.AddError($"{Movie.ToLower()} '{movie.Title}'"));
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            return ExecuteNonQuery(
                MovieQueries.DeleteMovie,
                HorrorObjectsParameters.IdParameters(id),
                RepositoryMessages.DeleteNotSuccess(Movie.ToLower()),
                RepositoryMessages.DeleteSuccess(Movie, id),
                RepositoryMessages.DeleteError(Movie.ToLower(), id));
        }

        /// <inheritdoc/>
        public override IEnumerable<Movie> GetAll()
        {
            return ExecuteReaderList(
                MovieQueries.GetAllMovie,
                null,
                ModelDataReader.MovieFunction(),
                RepositoryMessages.GetAllSuccess(Movies),
                RepositoryMessages.GetAllError(Movies));
        }

        /// <inheritdoc/>
        public override Movie? GetByTitle(string title)
        {
            return ExecuteReader(
                MovieQueries.GetMovieByName,
                HorrorObjectsParameters.GetByTitleParameters(title),
                ModelDataReader.MovieFunction(),
                RepositoryMessages.GetByTitleSuccess($"{Movie} '{title}'"),
                RepositoryMessages.GetByTitleNotFound($"{Movie} '{title}'"),
                RepositoryMessages.GetByTitleError(Movie.ToLower()));
        }

        /// <inheritdoc/>
        public override string Update(Movie entity)
        {
            return ExecuteNonQuery(
                MovieQueries.UpdateMovie,
                HorrorObjectsParameters.UpdateParameters(entity),
                RepositoryMessages.UpdateNotSuccess(Movie.ToLower()),
                RepositoryMessages.UpdateSuccess($"{Movie} '{entity.Title}'"),
                RepositoryMessages.UpdateError($"{Movie.ToLower()} '{entity.Title}'"));
        }

        /// <inheritdoc/>
        public IEnumerable<Movie> GetUnwatchedOrWatched(bool watched)
        {
            var query = watched ? MovieQueries.GetWatchedMovie : MovieQueries.GetUnwatchedMovie;
            var type = watched ? $"watched {Movies.ToLower()}" : $"unwatched {Movies.ToLower()}";

            return ExecuteReaderList(
                query,
                null,
                ModelDataReader.MovieFunction(),
                RepositoryMessages.GetUnwatchedOrWatchedSuccess(type),
                RepositoryMessages.GetUnwatchedOrWatchedError(type));
        }

        /// <inheritdoc/>
        public decimal GetTime(string query)
        {
            var message = QueryContainsWatched(query) ?
                RepositoryMessages.FetchingTotalTimeError($"watched {Movies.ToLower()}") :
                RepositoryMessages.FetchingTimeLeftError($"unwatched {Movies.ToLower()}");

            return ExecuteScalar(query, null, message);
        }

        /// <inheritdoc/>
        public IEnumerable<Movie> GetUnwatchedOrWatchedMoviesInSeries(bool watchedMovies, string seriesTitle)
        {
            var query = watchedMovies ? MovieQueries.GetWatchedMovieBySeriesName : MovieQueries.GetUnwatchedMovieBySeriesName;

            return ExecuteReaderList(
                query,
                HorrorObjectsParameters.GetByTitleParameters(seriesTitle),
                ModelDataReader.MovieFunction(),
                MoviesInSeriesMessage(watchedMovies, true),
                MoviesInSeriesMessage(watchedMovies, false));
        }

        /// <summary>
        /// Retrieves the message for the unwatched or watched movies in a series.
        /// </summary>
        /// <param name="watched">Watched or unwatched series.</param>
        /// <param name="success">Success or error.</param>
        /// <returns>The message.</returns>
        private static string MoviesInSeriesMessage(bool watched, bool success)
        {
            var status = success ? "Successfully retrieved list of" : "Error fetching";
            var watchStatus = watched ? "watched" : "unwatched";

            return $"{status} {watchStatus} {Movies.ToLower()} in the series.";
        }
    }
}