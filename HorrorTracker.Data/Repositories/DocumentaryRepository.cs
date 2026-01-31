using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Models.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Constants;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Data.Repositories.Records;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// Provides data access operations for documentary entities, including adding, updating, deleting, and retrieving
    /// documentaries from the underlying database.
    /// </summary>
    /// <remarks>This repository specializes in handling documentary objects and extends the base repository
    /// functionality with methods specific to documentaries, such as retrieving watched or unwatched items and
    /// calculating viewing times. All operations are logged and executed using the provided database connection. Thread
    /// safety and transaction management depend on the underlying database connection implementation.</remarks>
    /// <param name="databaseConnection">The database connection used to execute queries and commands against the data store.</param>
    /// <param name="loggerService">The logging service used to record repository operations and errors.</param>
    public class DocumentaryRepository(IDatabaseConnection databaseConnection, ILoggerService loggerService) :
        RepositoryBase<Documentary>(databaseConnection, loggerService), IDocumentaryRepository
    {
        private const string Documentary = "Documentary";
        private const string Documentaries = "Documentaries";

        /// <inheritdoc/>
        public override ExecutionNonQueryResult Add(Documentary entity)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.InsertDocumentary,
                HorrorObjectsParameters.InsertParameters(entity),
                string.Empty,
                RepositoryMessages.AddSuccess($"{Documentary} '{entity.Title}'"),
                RepositoryMessages.AddError($"{Documentary.ToLower()} '{entity.Title}'"));
        }

        /// <inheritdoc/>
        public override ExecutionNonQueryResult Delete(int id)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.DeleteDocumentary,
                HorrorObjectsParameters.IdParameters(id),
                RepositoryMessages.DeleteNotSuccess($"{Documentary.ToLower()}"),
                RepositoryMessages.DeleteSuccess($"{Documentary}", id),
                RepositoryMessages.DeleteError($"{Documentary.ToLower()}", id));
        }

        /// <inheritdoc/>
        public override IEnumerable<Documentary> GetAll()
        {
            return ExecuteReaderList(
                DocumentaryQueries.GetAllDocumentary,
                null,
                ModelDataReader.DocumentaryFunction(),
                RepositoryMessages.GetAllSuccess($"{Documentaries.ToLower()}"),
                RepositoryMessages.GetAllError($"{Documentaries.ToLower()}"));
        }

        /// <inheritdoc/>
        public override Documentary? GetByTitle(string title)
        {
            return ExecuteReader(
                DocumentaryQueries.GetDocumentaryByName,
                HorrorObjectsParameters.GetByTitleParameters(title),
                ModelDataReader.DocumentaryFunction(),
                RepositoryMessages.GetByTitleSuccess($"{Documentary} '{title}'"),
                RepositoryMessages.GetByTitleNotFound($"{Documentary} '{title}'"),
                RepositoryMessages.GetByTitleError($"{Documentary.ToLower()}"));
        }

        /// <inheritdoc/>
        public override ExecutionNonQueryResult Update(Documentary entity)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.UpdateDocumentary,
                HorrorObjectsParameters.UpdateParameters(entity),
                RepositoryMessages.UpdateNotSuccess($"{Documentary.ToLower()}"),
                RepositoryMessages.UpdateSuccess($"{Documentary} '{entity.Title}'"),
                RepositoryMessages.UpdateError($"{Documentary.ToLower()} '{entity.Title}'"));
        }

        /// <inheritdoc/>
        public IEnumerable<Documentary> GetUnwatchedOrWatched(bool watched)
        {
            var query = watched ? DocumentaryQueries.GetWatchedDocumentary : DocumentaryQueries.GetUnwatchedDocumentary;
            var type = watched ? "watched" : "unwatched";

            return ExecuteReaderList(
                query,
                null,
                ModelDataReader.DocumentaryFunction(),
                RepositoryMessages.GetUnwatchedOrWatchedSuccess($"{type} {Documentaries.ToLower()}"),
                RepositoryMessages.GetUnwatchedOrWatchedError($"{type} {Documentaries.ToLower()}"));
        }

        /// <inheritdoc/>
        public decimal GetTime(string query)
        {
            var message = QueryContainsWatched(query) ?
                RepositoryMessages.FetchingTotalTimeError($"watched {Documentaries.ToLower()}") :
                RepositoryMessages.FetchingTimeLeftError($"unwatched {Documentaries.ToLower()}");

            return ExecuteScalar(query, null, message);
        }
    }
}