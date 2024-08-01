using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Models.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
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
                $"Documentary '{entity.Title}' was added successfully.",
                $"Error adding documentary '{entity.Title}'.");
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.DeleteDocumentary,
                HorrorObjectsParameters.IdParameters(id),
                "Deleting documentary was not successful.",
                $"Documentary with ID '{id}' deleted successfully.",
                $"Error deleting documentary with ID '{id}'.");
        }

        /// <inheritdoc/>
        public override IEnumerable<Documentary> GetAll()
        {
            return ExecuteReaderList(
                DocumentaryQueries.GetAllDocumentary,
                null,
                ModelDataReader.DocumentaryFunction(),
                "Successfully retrieved all of the documentaries.",
                "Error fetching all of the documentaries.");
        }

        /// <inheritdoc/>
        public override Documentary? GetByTitle(string title)
        {
            return ExecuteReader(
                DocumentaryQueries.GetDocumentaryByName,
                HorrorObjectsParameters.GetByTitleParameters(title),
                ModelDataReader.DocumentaryFunction(),
                $"Documentary '{title}' was found in the database.",
                $"Documentary '{title}' not found in the database.",
                "An error occurred while getting the documentary by name.");
        }

        /// <inheritdoc/>
        public override string Update(Documentary entity)
        {
            return ExecuteNonQuery(
                DocumentaryQueries.UpdateDocumentary,
                HorrorObjectsParameters.UpdateParameters(entity),
                "Updating documentary was not successful.",
                $"Documentary '{entity.Title}' updated successfully.",
                $"Error updating documentary '{entity.Title}'.");
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
                    "Successfully retrieved list of watched documentaries.",
                    "Error fetching watched documentaries.");
            }

            return ExecuteReaderList(
                DocumentaryQueries.GetUnwatchedDocumentary,
                null,
                ModelDataReader.DocumentaryFunction(),
                "Successfully retrieved list of unwatched documentaries.",
                "Error fetching unwatched documentaries.");
        }

        /// <inheritdoc/>
        public decimal GetTime(string query)
        {
            if (QueryContainsWatched(query))
            {
                return ExecuteScalar(query, null, "Error fetching total time of watched documentaries.");
            }

            return ExecuteScalar(query, null, "Error fetching time left of unwatched documentaries.");
        }
    }
}