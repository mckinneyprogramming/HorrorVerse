using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models.Bases;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using System.Collections.ObjectModel;
using System.Data;

namespace HorrorTracker.Data.Repositories.Abstractions
{
    /// <summary>
    /// The <see cref="RepositoryBase{T}"/> class.
    /// </summary>
    /// <typeparam name="T">The horror object.</typeparam>
    public abstract class RepositoryBase<T> where T : HorrorBase
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
        /// Initializes a new instance of the <see cref="RepositoryBase{T}"/> class.
        /// </summary>
        protected RepositoryBase(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(_databaseConnection, _logger);
        }

        /// <summary>
        /// Add an item to the database.
        /// </summary>
        /// <param name="entity">The horror object.</param>
        /// <returns></returns>
        public abstract int Add(T entity);

        /// <summary>
        /// Deletes an item in the database.
        /// </summary>
        /// <param name="id">The id.</param>
        /// <returns>the message.</returns>
        public abstract string Delete(int id);

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
        public abstract string Update(T entity);

        /// <summary>
        /// Performs the non-query command on the database.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="parameters">The parameters.</param>
        /// <param name="successMessage">The success message.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The success result.</returns>
        protected int ExecuteNonQuery(string query, ReadOnlyDictionary<string, object> parameters, string successMessage, string errorMessage)
        {
            var result = 0;
            try
            {
                _databaseConnectionsHelper.Open();
                result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    _logger.LogInformation(successMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(errorMessage, ex);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }

        /// <summary>
        /// Performs the non-query command on the database.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="parameters">The parameters.</param>
        /// <param name="failedMessage">The failed message.</param>
        /// <param name="successMessage">The success message.</param>
        /// <param name="errorMessage">The error message.</param>
        /// <returns>The message.</returns>
        protected string ExecuteNonQuery(string query, ReadOnlyDictionary<string, object> parameters, string failedMessage, string successMessage, string errorMessage)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    _logger.LogInformation(successMessage);
                    return successMessage;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(errorMessage, ex);
                return errorMessage;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return failedMessage;
        }

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
            catch (Exception ex)
            {
                _logger.LogError(errorMessage, ex);
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
            catch (Exception ex)
            {
                _logger.LogError(errorMessage, ex);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }
    }
}