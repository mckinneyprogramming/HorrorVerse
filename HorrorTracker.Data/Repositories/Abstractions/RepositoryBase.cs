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
    /// The <see cref="RepositoryBase{T}"/> class.
    /// </summary>
    /// <typeparam name="T">The horror object.</typeparam>
    /// <remarks>
    /// Initializes a new instance of the <see cref="RepositoryBase{T}"/> class.
    /// </remarks>
    public abstract class RepositoryBase<T>(IDatabaseConnection databaseConnection, ILoggerService logger)
        : ExecutorBase(databaseConnection, logger) where T : HorrorBase
    {
        /// <summary>
        /// Add an item to the database.
        /// </summary>
        /// <param name="entity">The horror object.</param>
        /// <returns></returns>
        public abstract ExecutionNonQueryResult Add(T entity);

        /// <summary>
        /// Deletes an item in the database.
        /// </summary>
        /// <param name="id">The id.</param>
        /// <returns>the message.</returns>
        public abstract ExecutionNonQueryResult Delete(int id);

        /// <summary>
        /// Retrieves all the items from the database.
        /// </summary>
        /// <returns>The list/array of items.</returns>
        public abstract IEnumerable<T> GetAll();

        /// <summary>
        /// Retrieves the item from the database by the title.
        /// </summary>
        /// <param name="title">The title of the object.</param>
        /// <returns>The item.</returns>
        public abstract T? GetByTitle(string title);

        /// <summary>
        /// Updates an item in the database.
        /// </summary>
        /// <param name="entity">The horror object.</param>
        /// <returns>The message.</returns>
        public abstract ExecutionNonQueryResult Update(T entity);

        /// <summary>
        /// Performs the reader command on the database.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="parameters">The parameters.</param>
        /// <param name="parse">The function of the data reader.</param>
        /// <param name="successMessage">The success message.</param>
        /// <param name="notFoundMessage">The not found message.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The object.</returns>
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
        /// Performs the reader on a list command on the database.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="parameters">The parameters.</param>
        /// <param name="parse">the function of the data reader.</param>
        /// <param name="successMessage">The success message.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The list of objects.</returns>
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