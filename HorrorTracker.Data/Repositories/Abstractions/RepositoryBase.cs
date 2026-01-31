using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models.Bases;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Records;
using HorrorTracker.Utilities.Logging.Interfaces;
using System.Collections.ObjectModel;
using System.Data;

namespace HorrorTracker.Data.Repositories.Abstractions
{
    /// <summary>
    /// Provides a base implementation for a repository that manages horror entities in a database, supporting common
    /// data operations such as add, update, delete, and retrieval.
    /// </summary>
    /// <remarks>This abstract class defines the standard CRUD operations for horror entities and provides
    /// protected helper methods for executing database queries. Derived classes should implement the abstract methods
    /// to specify entity-specific behavior. All operations are performed using the provided database connection and
    /// logger service. Thread safety and transaction management are the responsibility of the derived
    /// implementation.</remarks>
    /// <typeparam name="T">The type of horror entity managed by the repository. Must inherit from <see cref="HorrorBase"/>.</typeparam>
    /// <param name="databaseConnection">The database connection used to perform data operations.</param>
    /// <param name="logger">The logger service used for logging information and errors during repository operations.</param>
    public abstract class RepositoryBase<T>(IDatabaseConnection databaseConnection, ILoggerService logger)
        : ExecutorBase(databaseConnection, logger) where T : HorrorBase
    {
        /// <summary>
        /// Adds the specified entity to the underlying data store.
        /// </summary>
        /// <param name="entity">The entity to add. Cannot be null.</param>
        /// <returns>An ExecutionNonQueryResult indicating the outcome of the add operation, including success or failure
        /// details.</returns>
        public abstract ExecutionNonQueryResult Add(T entity);

        /// <summary>
        /// Deletes the entity with the specified identifier from the data store.
        /// </summary>
        /// <param name="id">The unique identifier of the entity to delete. Must be a valid, existing identifier.</param>
        /// <returns>An ExecutionNonQueryResult indicating the outcome of the delete operation, including the number of affected
        /// records and any error information.</returns>
        public abstract ExecutionNonQueryResult Delete(int id);

        /// <summary>
        /// Retrieves all entities of type <typeparamref name="T"/> from the data source.
        /// </summary>
        /// <returns>An <see cref="IEnumerable{T}"/> containing all entities of type <typeparamref name="T"/>. The collection
        /// will be empty if no entities are found.</returns>
        public abstract IEnumerable<T> GetAll();

        /// <summary>
        /// Retrieves an item of type <typeparamref name="T"/> that matches the specified title.
        /// </summary>
        /// <param name="title">The title of the item to locate. The comparison may be case-sensitive or case-insensitive depending on the
        /// implementation.</param>
        /// <returns>An instance of type <typeparamref name="T"/> that matches the specified title, or null if no matching item is found.</returns>
        public abstract T? GetByTitle(string title);

        /// <summary>
        /// Updates the specified entity in the underlying data store.
        /// </summary>
        /// <param name="entity">The entity to update. Must not be null. The entity should contain the updated values to be persisted.</param>
        /// <returns>An ExecutionNonQueryResult indicating the outcome of the update operation, including the number of affected
        /// records and any relevant status information.</returns>
        public abstract ExecutionNonQueryResult Update(T entity);

        /// <summary>
        /// Executes the specified SQL query and parses the first result row using the provided delegate.
        /// </summary>
        /// <remarks>This method opens and closes the database connection automatically. Only the first
        /// result row is parsed and returned. Logging is performed for success, not found, and error
        /// scenarios.</remarks>
        /// <param name="query">The SQL query to execute against the database. Must be a valid query string.</param>
        /// <param name="parameters">An optional read-only dictionary containing parameter names and values to be applied to the query. Can be
        /// null if the query does not require parameters.</param>
        /// <param name="parse">A delegate that parses an IDataReader representing a result row and returns an instance of type T.</param>
        /// <param name="successMessage">The message to log if a result row is found and parsed successfully.</param>
        /// <param name="notFoundMessage">The message to log if no result rows are returned by the query.</param>
        /// <param name="errorMessage">The message to log if an exception occurs during query execution or parsing.</param>
        /// <returns>An instance of type <typeparamref name="T"/> parsed from the first result row if available; otherwise, null.</returns>
        protected T? ExecuteReader(string query, ReadOnlyDictionary<string, object>? parameters, Func<IDataReader, T> parse, string successMessage, string notFoundMessage, string errorMessage)
        {
            T? result = null;
            try
            {
                _databaseConnectionsHelper.Open();
                using var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, query, parameters);

                if (reader.Read())
                {
                    result = parse(reader);
                    _logger.LogInformation(successMessage);
                }
                else
                {
                    _logger.LogWarning(notFoundMessage);
                }
            }
            catch (Exception exception)
            {
                HandleException(exception, errorMessage);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }

        /// <summary>
        /// Executes the specified SQL query and returns a collection of parsed results of type <typeparamref name="T"/>.
        /// </summary>
        /// <remarks>The database connection is opened before executing the query and closed after
        /// completion. If an exception occurs, the specified error message is logged and an empty collection is
        /// returned. The caller is responsible for providing a suitable parse function for mapping IDataReader rows to
        /// <typeparamref name="T"/>.</remarks>
        /// <param name="query">The SQL query to execute against the database. Must be a valid query string.</param>
        /// <param name="parameters">An optional read-only dictionary containing parameter names and values to be applied to the query. Can be
        /// null if the query does not require parameters.</param>
        /// <param name="parse">A delegate that parses each IDataReader row into an instance of type <typeparamref name="T"/>. Called for each row in the result
        /// set.</param>
        /// <param name="successMessage">The message to log if the query executes successfully.</param>
        /// <param name="errorMessage">The message to log if an exception occurs during query execution.</param>
        /// <returns>An enumerable collection of type <typeparamref name="T"/> containing the parsed results from the query. The collection will be
        /// empty if no rows are returned or if an exception occurs.</returns>
        protected IEnumerable<T> ExecuteReaderList(string query, ReadOnlyDictionary<string, object>? parameters, Func<IDataReader, T> parse, string successMessage, string errorMessage)
        {
            var result = new List<T>();
            try
            {
                _databaseConnectionsHelper.Open();
                using var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, query, parameters);

                while (reader.Read())
                {
                    result.Add(parse(reader));
                }

                _logger.LogInformation(successMessage);
            }
            catch (Exception exception)
            {
                HandleException(exception, errorMessage);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }
    }
}