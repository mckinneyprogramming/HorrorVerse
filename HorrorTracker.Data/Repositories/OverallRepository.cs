using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="OverallRepository"/> class.
    /// </summary>
    public class OverallRepository : ExecutorBase, IOverallRepository
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="OverallRepository"/> class.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="logger">The logger service.</param>
        public OverallRepository(IDatabaseConnection connection, ILoggerService logger)
            : base(connection, logger)
        {
        }

        /// <inheritdoc/>
        public decimal GetOverallTime()
        {
            return ExecuteScalar(OverallQueries.RetrieveOverallTime, null, "Retrieving the overall time from the database failed.");
        }

        /// <inheritdoc/>
        public decimal GetOverallTimeLeft()
        {
            return ExecuteScalar(OverallQueries.RetrieveOverallTimeLeft, null, "Retrieving the overall time left from the database failed.");
        }
    }
}