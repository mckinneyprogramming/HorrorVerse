using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieRepository"/> class.
    /// </summary>
    /// <seealso cref="IMovieRepository"/>
    public class MovieRepository : IMovieRepository
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
        /// Initializes a new instance of the <see cref="MovieSeriesRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public MovieRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(databaseConnection, logger);
        }
    }
}