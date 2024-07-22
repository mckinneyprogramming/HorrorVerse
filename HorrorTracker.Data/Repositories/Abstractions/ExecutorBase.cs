using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Repositories.Abstractions
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ExecutorBase{T}"/> class.
    /// </summary>
    /// <typeparam name="T">The horror object.</typeparam>
    public abstract class ExecutorBase
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
        /// Initializes a new instance of the <see cref="ExecutorBase{T}"/> class.
        /// </summary>
        protected ExecutorBase(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(_databaseConnection, _logger);
        }

        /// <summary>
        /// Performs the scalar on the command on the database.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="parameters">The parameters.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The calculated decimal value.</returns>
        protected decimal ExecuteScalar(string query, ReadOnlyDictionary<string, object>? parameters, string errorMessage)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var result = DatabaseCommandsHelper.ExecutesScalar(_databaseConnection, query, parameters);
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
        /// Checks if the query contains Watched equals true.
        /// </summary>
        /// <param name="query">The query string.</param>
        /// <returns>True if query contains value; false otherwise.</returns>
        protected static bool QueryContainsWatched(string query)
        {
            return query.Contains("Watched = TRUE");
        }

        /// <summary>
        /// Retrieves the decimal value.
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