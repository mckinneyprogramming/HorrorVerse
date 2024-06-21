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
            try
            {
                _databaseConnectionsHelper.Open();
                var result = DatabaseCommandsHelper.ExecutesScalar(_connection, OverallQueries.RetrieveOverallTime);
                return RetrievesDecimalTimeValue(result);
            }
            catch (Exception ex)
            {
                _logger.LogError("Retrieving the overall time from the database failed.", ex);
                return 0.0M;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public decimal GetOverallTimeLeft()
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var result = DatabaseCommandsHelper.ExecutesScalar(_connection, OverallQueries.RetrieveOverallTimeLeft);
                return RetrievesDecimalTimeValue(result);
            }
            catch (Exception ex)
            {
                _logger.LogError("Retrieving the overall time left from the database failed.", ex);
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
        private static decimal RetrievesDecimalTimeValue(object? result)
        {
            if (result == null)
            {
                return 0.0M;
            }

            var isDecimal = Parser.IsDecimal(result, out var decimalValue);
            if (isDecimal)
            {
                return decimalValue;
            }

            return decimalValue;
        }
    }
}