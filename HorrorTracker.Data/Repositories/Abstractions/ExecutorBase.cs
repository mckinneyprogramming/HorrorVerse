using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Records;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Repositories.Abstractions
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ExecutorBase"/> class.
    /// </summary>
    public abstract class ExecutorBase
    {
        protected IDatabaseConnection _databaseConnection;
        protected ILoggerService _logger;
        protected DatabaseConnectionsHelper _databaseConnectionsHelper;

        /// <summary>
        /// Initializes a new instance of the <see cref="ExecutorBase"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        protected ExecutorBase(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(_databaseConnection);
        }

        /// <summary>
        /// Performs the non query command on the database.
        /// </summary>
        /// <param name="query">The SQL query string.</param>
        /// <param name="parameters">The parameters.</param>
        /// <param name="failedMessage">The failed message.</param>
        /// <param name="successMessage">The success message.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The result.</returns>
        protected ExecutionNonQueryResult ExecuteNonQuery(
            string query,
            ReadOnlyDictionary<string, object> parameters,
            string failedMessage,
            string successMessage,
            string errorMessage)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var rowsAffected = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(rowsAffected))
                {
                    _logger.LogInformation(successMessage);
                    return new(rowsAffected, true, successMessage);
                }

                return new(rowsAffected, false, failedMessage);
            }
            catch (Exception exception)
            {
                HandleException(exception, errorMessage);
                return new(0, false, errorMessage);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
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
        /// Logs the exception.
        /// </summary>
        /// <param name="exception">The exception.</param>
        /// <param name="errorMessage">The error message.</param>
        protected void HandleException(Exception exception, string errorMessage)
        {
            _logger.LogError(errorMessage, exception);
        }

        /// <summary>
        /// Checks if the query contains Watched equals true.
        /// </summary>
        /// <param name="query">The query string.</param>
        /// <returns>True if query contains value; false otherwise.</returns>
        protected static bool QueryContainsWatched(string query)
        {
            return query.Contains("watched = true", StringComparison.OrdinalIgnoreCase);
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