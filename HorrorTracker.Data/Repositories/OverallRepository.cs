using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="OverallRepository"/> class.
    /// </summary>
    public class OverallRepository : IOverallRepository
    {
        /// <summary>
        /// The database connection.
        /// </summary>
        private readonly IDatabaseConnection _connection;

        /// <summary>
        /// The logger service.
        /// </summary>
        private readonly ILoggerService _logger;

        /// <summary>
        /// The logger helper.
        /// </summary>
        private readonly DatabaseConnectionsHelper _databaseConnectionsHelper;

        /// <summary>
        /// Initializes a new instance of the <see cref="OverallRepository"/> class.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="logger">The logger service.</param>
        public OverallRepository(IDatabaseConnection connection, ILoggerService logger)
        {
            _connection = connection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(connection, logger);
        }

        /// <inheritdoc/>
        public decimal GetOverallTime()
        {
            return RetrieveTime(OverallQueries.RetrieveOverallTime, "Retrieving the overall time from the database failed.");
        }

        /// <inheritdoc/>
        public decimal GetOverallTimeLeft()
        {
            return RetrieveTime(OverallQueries.RetrieveOverallTimeLeft, "Retrieving the overall time left from the database failed.");
        }

        /// <summary>
        /// Retrieves the time value from the database using the specified query.
        /// </summary>
        /// <param name="query">The query to execute.</param>
        /// <param name="errorMessage">The error message to log in case of failure.</param>
        /// <returns>The decimal time value.</returns>
        private decimal RetrieveTime(string query, string errorMessage)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var result = DatabaseCommandsHelper.ExecutesScalar(_connection, query);
                return RetrievesDecimalTimeValue(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(errorMessage, ex);
                return 0.0M;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <summary>
        /// Retrieves the the decimal value.
        /// </summary>
        /// <param name="result">The result from the execute.</param>
        /// <returns>The decimal value.</returns>
        private decimal RetrievesDecimalTimeValue(object? result)
        {
            if (result == null)
            {
                _logger.LogWarning("Time was not calculated or found in the database.");
                return 0.0M;
            }

            var parser = new Parser();
            var isDecimal = parser.IsDecimal(result, out var decimalValue);
            if (isDecimal)
            {
                _logger.LogInformation($"Time in the database: {decimalValue} was retrieved successfully.");
                return decimalValue;
            }

            _logger.LogWarning("Time was not a valid decimal.");
            return decimalValue;
        }
    }
}