using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Records;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Repositories.Abstractions
{
    /// <summary>
    /// Provides a base class for executing database commands with logging and connection management support.
    /// </summary>
    /// <remarks>This abstract class encapsulates common functionality for executing SQL queries, handling
    /// database connections, and logging operations. Derived classes should implement specific command execution logic
    /// by utilizing the protected members. All database operations performed through this class are logged using the
    /// provided logger service. Connection management is handled automatically for each operation to ensure resources
    /// are properly released.</remarks>
    public abstract class ExecutorBase
    {
        protected IDatabaseConnection _databaseConnection;
        protected ILoggerService _logger;
        protected DatabaseConnectionsHelper _databaseConnectionsHelper;

        /// <summary>
        /// Initializes a new instance of the ExecutorBase class with the specified database connection and logger service.
        /// </summary>
        /// <param name="databaseConnection">The database connection to be used for executing database operations. Cannot be null.</param>
        /// <param name="logger">The logger service used for logging execution details and errors. Cannot be null.</param>
        protected ExecutorBase(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(_databaseConnection);
        }

        /// <summary>
        /// Executes a non-query SQL command against the database and returns the result, including the number of
        /// affected rows and a status message.
        /// </summary>
        /// <remarks>The database connection is opened before execution and closed afterward, regardless
        /// of success or failure. If an exception occurs, the result will indicate failure and include the specified
        /// error message.</remarks>
        /// <param name="query">The SQL statement to execute. This should be a non-query command such as INSERT, UPDATE, or DELETE.</param>
        /// <param name="parameters">A read-only dictionary containing parameter names and values to be used with the SQL command. Can be empty
        /// if the query does not require parameters.</param>
        /// <param name="failedMessage">The message to associate with the result if the command executes but does not succeed according to business
        /// logic.</param>
        /// <param name="successMessage">The message to associate with the result if the command executes successfully.</param>
        /// <param name="errorMessage">The message to associate with the result if an exception occurs during execution.</param>
        /// <returns>An ExecutionNonQueryResult containing the number of rows affected, a success flag, and the appropriate
        /// status message based on the outcome.</returns>
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
        /// Executes the specified SQL query and returns the resulting value as a decimal.
        /// </summary>
        /// <remarks>This method opens and closes the database connection for each execution. If the query
        /// does not return a value convertible to decimal, the result may be 0.0. The error message provided is logged
        /// if an exception is thrown during execution.</remarks>
        /// <param name="query">The SQL query to execute. Must be a valid statement that returns a single scalar value.</param>
        /// <param name="parameters">An optional read-only dictionary containing parameter names and values to be used with the query. Can be
        /// null if the query does not require parameters.</param>
        /// <param name="errorMessage">The error message to log if the query execution fails.</param>
        /// <returns>The decimal value resulting from the executed query. Returns 0.0 if an error occurs during execution.</returns>
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
        /// Logs the specified exception and error message using the configured logger.
        /// </summary>
        /// <remarks>This method is intended to provide a consistent approach for logging exceptions
        /// within derived classes. The error message should clearly describe the context in which the exception
        /// occurred to aid in troubleshooting.</remarks>
        /// <param name="exception">The exception to be logged. Cannot be null.</param>
        /// <param name="errorMessage">A descriptive error message to accompany the exception in the log entry. Cannot be null or empty.</param>
        protected void HandleException(Exception exception, string errorMessage)
        {
            _logger.LogError(errorMessage, exception);
        }

        /// <summary>
        /// Determines whether the specified query string includes a condition that filters for watched items.
        /// </summary>
        /// <param name="query">The query string to examine for the presence of a 'watched = true' condition. Cannot be null.</param>
        /// <returns>true if the query string contains 'watched = true' (case-insensitive); otherwise, false.</returns>
        protected static bool QueryContainsWatched(string query)
        {
            return query.Contains("watched = true", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Retrieves a decimal time value from the specified result object, returning zero if the value is not present
        /// or not a valid decimal.
        /// </summary>
        /// <param name="result">The object containing the time value to retrieve. Can be null or any type; if not a valid decimal, zero is
        /// returned.</param>
        /// <returns>The decimal time value extracted from the result object, or zero if the value is missing or invalid.</returns>
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