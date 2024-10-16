using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Models.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Constants;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="DocumentaryRepository"/> class.
    /// </summary>
    /// <seealso cref="RepositoryBase{T}"/>
    /// <seealso cref="IDocumentaryRepository"/>
    public class DocumentaryRepository : RepositoryBase<Documentary>, IDocumentaryRepository
    {
        /// <summary>
        /// Documentary string.
        /// </summary>
        private const string Documentary = "Documentary";

        /// <summary>
        /// Documentaries string.
        /// </summary>
        private const string Documentaries = "Documentaries";

        /// <summary>
        /// Initializes a new instance of the <see cref="DocumentaryRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="loggerService">The logger service.</param>
        public DocumentaryRepository(IDatabaseConnection databaseConnection, ILoggerService loggerService)
            : base (databaseConnection, loggerService)
        {
        }

        /// <inheritdoc/>
        public override int Add(Documentary entity)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.InsertDocumentary,
                HorrorObjectsParameters.InsertParameters(entity),
                RepositoryMessages.AddSuccess($"{Documentary} '{entity.Title}'"),
                RepositoryMessages.AddError($"{Documentary.ToLower()} '{entity.Title}'"));
        }

        /// <inheritdoc/>
        public override string Delete(int id)
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
        public override string Update(Documentary entity)
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