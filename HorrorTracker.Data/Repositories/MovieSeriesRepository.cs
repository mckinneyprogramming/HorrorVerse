using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieSeriesRepository"/> class.
    /// </summary>
    public class MovieSeriesRepository : RepositoryBase<MovieSeries>, IMovieSeriesRepository
    {
        /// <summary>
        /// The database connection.
        /// </summary>
        private readonly IDatabaseConnection _databaseConnection;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILoggerService _logger;

        /// <summary>
        /// The logger helper.
        /// </summary>
        private readonly DatabaseConnectionsHelper _databaseConnectionsHelper;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeriesRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public MovieSeriesRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
            : base(databaseConnection, logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(databaseConnection, logger);
        }

        /// <inheritdoc/>
        public override int Add(MovieSeries series)
        {
            return ExecuteNonQuery(
                MovieSeriesQueries.InsertSeries,
                MovieSeriesDatabaseParameters.InsertMovieSeriesParameters(series),
                $"Movie series {series.Title} was added successfully.",
                "Adding a movie series to the database failed.");
        }

        /// <inheritdoc/>
        public override MovieSeries? GetByTitle(string title)
        {
            return ExecuteReader(
                MovieSeriesQueries.GetMovieSeriesByName,
                SharedDatabaseParameters.GetByTitleParameters(title),
                reader => new MovieSeries(reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0)),
                $"Movie series {title} was found in the database.",
                $"Movie series {title} was not found in the database.",
                "An error occurred while getting the movie series by name.");
        }

        /// <inheritdoc/>
        public override string Update(MovieSeries series)
        {
            return ExecuteNonQuery(
                MovieSeriesQueries.UpdateMovieSeries,
                MovieSeriesDatabaseParameters.UpdateMovieSeriesParameters(series),
                "Updating movie series was not successful.",
                "Series updated successfully.",
                $"Error updating series '{series.Title}'.");
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            return ExecuteNonQuery(
                MovieSeriesQueries.DeleteMovieSeries,
                SharedDatabaseParameters.IdParameters(id),
                "Deleting movie series was not successful.",
                $"Series with ID '{id}' deleted successfully.",
                $"Error deleting series with ID '{id}'.");
        }

        /// <inheritdoc/>
        public override IEnumerable<MovieSeries> GetUnwatchedOrWatchedByTitle(string title, string query)
        {
            return ExecuteReaderList(
                query,
                SharedDatabaseParameters.GetByTitleParameters(title),
                reader => new MovieSeries(reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0)),
                "Retrieved movie series(s) successfully.",
                $"Error fetching series's '{title}'.");
        }

        /// <inheritdoc/>
        public string UpdateTotalTime(int seriesId)
        {
            return UpdateSeries(
                seriesId,
                MovieSeriesQueries.UpdateTotalTime,
                "Updating total time for the series was not successful.",
                "Total time for series ID '{0}' updated successfully.",
                "Error updating total time for series ID '{0}'.");
        }

        /// <inheritdoc/>
        public string UpdateTotalMovies(int seriesId)
        {
            return UpdateSeries(
                seriesId,
                MovieSeriesQueries.UpdateTotalMovies,
                "Updating the total movies for the series was not successful.",
                "Total movies for series ID '{0}' updated successfully.",
                "Error updating total movies for series ID '{0}'.");
        }

        /// <inheritdoc/>
        public string UpdateWatched(int seriesId)
        {
            return UpdateSeries(
                seriesId,
                MovieSeriesQueries.UpdateWatched,
                "Updating watched for the series was not successful.",
                "Watched status for series ID '{0}' updated successfully.",
                "Error updating watched status for series ID '{0}'.");
        }

        /// <inheritdoc/>
        public decimal GetTimeLeft(int seriesId)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.GetTimeLeft;
                var parameters = SharedDatabaseParameters.IdParameters(seriesId);
                var result = DatabaseCommandsHelper.ExecutesScalar(_databaseConnection, query, parameters);
                var parser = new Parser();
#pragma warning disable CS8604 // Possible null reference argument.
                _ = parser.IsDecimal(result, out var decimalValue);
#pragma warning restore CS8604 // Possible null reference argument.

                _logger.LogInformation("Retrieving time left for movie series was successful.");
                return decimalValue;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching time left for series ID '{seriesId}'.", ex);
                return 0.0M;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public override IEnumerable<MovieSeries> GetAll()
        {
            return ExecuteReaderList(
                MovieSeriesQueries.GetAllSeries,
                null,
                reader => new MovieSeries(reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0)),
                "Retrieving all the movie series was successful.",
                "Error fetching all movie series.");
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
                SharedDatabaseParameters.IdParameters(seriesId),
                failedMessage,
                string.Format(successMessage, seriesId),
                string.Format(errorMessage, seriesId));
        }
    }
}