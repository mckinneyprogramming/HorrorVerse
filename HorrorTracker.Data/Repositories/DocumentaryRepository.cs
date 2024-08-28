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
                RepositoryMessages.AddSuccess($"Documentary '{entity.Title}'"),
                RepositoryMessages.AddError($"documentary '{entity.Title}'"));
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.DeleteDocumentary,
                HorrorObjectsParameters.IdParameters(id),
                RepositoryMessages.DeleteNotSuccess("documentary"),
                RepositoryMessages.DeleteSuccess("Documentary", id),
                RepositoryMessages.DeleteError("documentary", id));
        }

        /// <inheritdoc/>
        public override IEnumerable<Documentary> GetAll()
        {
            return ExecuteReaderList(
                DocumentaryQueries.GetAllDocumentary,
                null,
                ModelDataReader.DocumentaryFunction(),
                RepositoryMessages.GetAllSuccess("documentaries"),
                RepositoryMessages.GetAllError("documentaries"));
        }

        /// <inheritdoc/>
        public override Documentary? GetByTitle(string title)
        {
            return ExecuteReader(
                DocumentaryQueries.GetDocumentaryByName,
                HorrorObjectsParameters.GetByTitleParameters(title),
                ModelDataReader.DocumentaryFunction(),
                RepositoryMessages.GetByTitleSuccess($"Documentary '{title}'"),
                RepositoryMessages.GetByTitleNotFound($"Documentary '{title}'"),
                RepositoryMessages.GetByTitleError("documentary"));
        }

        /// <inheritdoc/>
        public override string Update(Documentary entity)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.UpdateDocumentary,
                HorrorObjectsParameters.UpdateParameters(entity),
                RepositoryMessages.UpdateNotSuccess("documentary"),
                RepositoryMessages.UpdateSuccess($"Documentary '{entity.Title}'"),
                RepositoryMessages.UpdateError($"documentary '{entity.Title}'"));
        }

        /// <inheritdoc/>
        public IEnumerable<Documentary> GetUnwatchedOrWatched(bool watched)
        {
            if (watched)
            {
                return ExecuteReaderList(
                    DocumentaryQueries.GetWatchedDocumentary,
                    null,
                    ModelDataReader.DocumentaryFunction(),
                    RepositoryMessages.GetUnwatchedOrWatchedSuccess("watched documentaries"),
                    RepositoryMessages.GetUnwatchedOrWatchedError("watched documentaries"));
            }

            return ExecuteReaderList(
                DocumentaryQueries.GetUnwatchedDocumentary,
                null,
                ModelDataReader.DocumentaryFunction(),
                RepositoryMessages.GetUnwatchedOrWatchedSuccess("unwatched documentaries"),
                RepositoryMessages.GetUnwatchedOrWatchedError("unwatched documentaries"));
        }

        /// <inheritdoc/>
        public decimal GetTime(string query)
        {
            if (QueryContainsWatched(query))
            {
                return ExecuteScalar(query, null, RepositoryMessages.FetchingTotalTimeError("watched documentaries"));
            }

            return ExecuteScalar(query, null, RepositoryMessages.FetchingTimeLeftError("unwatched documentaries"));
        }
    }
}