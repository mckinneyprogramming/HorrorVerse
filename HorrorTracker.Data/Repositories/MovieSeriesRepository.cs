using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Models.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Constants;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieSeriesRepository"/> class.
    /// </summary>
    public class MovieSeriesRepository : RepositoryBase<MovieSeries>, IMovieSeriesRepository
    {
        /// <summary>
        /// The constant movie series string.
        /// </summary>
        private const string MovieSeries = "Movie series";

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeriesRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public MovieSeriesRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
            : base(databaseConnection, logger)
        {
        }

        /// <inheritdoc/>
        public override int Add(MovieSeries series)
        {
            return ExecuteNonQuery(
                MovieSeriesQueries.InsertSeries,
                HorrorObjectsParameters.InsertParameters(series),
                RepositoryMessages.AddSuccess($"{MovieSeries} {series.Title}"),
                RepositoryMessages.AddError(MovieSeries.ToLower()));
        }

        /// <inheritdoc/>
        public override MovieSeries? GetByTitle(string title)
        {
            return ExecuteReader(
                MovieSeriesQueries.GetMovieSeriesByName,
                HorrorObjectsParameters.GetByTitleParameters(title),
                ModelDataReader.MovieSeriesFunction(),
                GetByTitleSuccessAndErrorMessage(title),
                RepositoryMessages.GetByTitleNotFound($"{MovieSeries} {title}"),
                GetByTitleSuccessAndErrorMessage(title, false));
        }

        /// <inheritdoc/>
        public override string Update(MovieSeries series)
        {
            return ExecuteNonQuery(
                MovieSeriesQueries.UpdateMovieSeries,
                HorrorObjectsParameters.UpdateParameters(series),
                RepositoryMessages.UpdateNotSuccess(MovieSeries.ToLower()),
                RepositoryMessages.UpdateSuccess("Series"),
                RepositoryMessages.UpdateError($"series '{series.Title}'"));
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            return ExecuteNonQuery(
                MovieSeriesQueries.DeleteMovieSeries,
                HorrorObjectsParameters.IdParameters(id),
                RepositoryMessages.DeleteNotSuccess(MovieSeries.ToLower()),
                RepositoryMessages.DeleteSuccess("Series", id),
                RepositoryMessages.DeleteError("series", id));
        }

        /// <inheritdoc/>
        public IEnumerable<MovieSeries> GetUnwatchedOrWatchedMovieSeries(string query)
        {
            var type = QueryContainsWatched(query) ? "watched" : "unwatched";

            return ExecuteReaderList(
                query,
                null,
                ModelDataReader.MovieSeriesFunction(),
                RepositoryMessages.GetUnwatchedOrWatchedSuccess($"{type} {MovieSeries.ToLower()}(s)"),
                RepositoryMessages.GetUnwatchedOrWatchedError($"{type} {MovieSeries.ToLower()}'s"));
        }

        /// <inheritdoc/>
        public string UpdateTotalTime(int seriesId) => UpdateMovieSeriesProperty(seriesId, MovieSeriesQueries.UpdateTotalTime, "total time");

        /// <inheritdoc/>
        public string UpdateTotalMovies(int seriesId) => UpdateMovieSeriesProperty(seriesId, MovieSeriesQueries.UpdateTotalMovies, "total movies");

        /// <inheritdoc/>
        public string UpdateWatched(int seriesId) => UpdateMovieSeriesProperty(seriesId, MovieSeriesQueries.UpdateWatched, "watched");

        /// <inheritdoc/>
        public decimal GetTimeLeft(int seriesId)
        {
            return ExecuteScalar(
                MovieSeriesQueries.GetTimeLeft,
                HorrorObjectsParameters.IdParameters(seriesId),
                RepositoryMessages.FetchingTimeLeftError($"series with ID '{seriesId}'"));
        }

        /// <inheritdoc/>
        public override IEnumerable<MovieSeries> GetAll()
        {
            return ExecuteReaderList(
                MovieSeriesQueries.GetAllSeries,
                null,
                ModelDataReader.MovieSeriesFunction(),
                RepositoryMessages.GetAllSuccess(MovieSeries.ToLower()),
                RepositoryMessages.GetAllError(MovieSeries.ToLower()));
        }

        /// <summary>
        /// Retrieves the success or error message for getting a movie series by title.
        /// </summary>
        /// <param name="title">The title of the movie series.</param>
        /// <param name="success">If the execute is successful or not.</param>
        /// <returns>The message.</returns>
        private static string GetByTitleSuccessAndErrorMessage(string title, bool success = true)
        {
            return success
                ? RepositoryMessages.GetByTitleSuccess($"{MovieSeries} {title}")
                : RepositoryMessages.GetByTitleError(MovieSeries.ToLower());
        }

        /// <summary>
        /// Updates the properties for the movie series.
        /// </summary>
        /// <param name="seriesId">The series id.</param>
        /// <param name="query">The query.</param>
        /// <param name="type">The substring value.</param>
        /// <returns>The message.</returns>
        private string UpdateMovieSeriesProperty(int seriesId, string query, string type)
        {
            return UpdateSeries(
                seriesId,
                query,
                RepositoryMessages.UpdateNotSuccess($"{type} for the series"),
                RepositoryMessages.UpdateSuccess($"{StringUtility.CapitalizeFirstLetter(type)} for series ID '{{0}}'"),
                RepositoryMessages.UpdateError($"{type} for series ID '{{0}}'"));
        }

        /// <summary>
        /// Updates the particular parameter.
        /// </summary>
        /// <param name="seriesId">The series id.</param>
        /// <param name="query">The query.</param>
        /// <param name="failedMessage">The failed message.</param>
        /// <param name="successMessage">The success message.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The message.</returns>
        private string UpdateSeries(int seriesId, string query, string failedMessage, string successMessage, string errorMessage)
        {
            return ExecuteNonQuery(
                query,
                HorrorObjectsParameters.IdParameters(seriesId),
                failedMessage,
                string.Format(successMessage, seriesId),
                string.Format(errorMessage, seriesId));
        }
    }
}