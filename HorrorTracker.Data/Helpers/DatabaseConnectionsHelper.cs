using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Helpers
{
    /// <summary>
    /// The <see cref="DatabaseConnectionsHelper"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="DatabaseConnectionsHelper"/> class.
    /// </remarks>
    /// <param name="connection">The database connection.</param>
    /// <param name="loggerService">The logger service.</param>
    public class DatabaseConnectionsHelper(IDatabaseConnection connection, ILoggerService loggerService)
    {
        /// <summary>
        /// The database connection.
        /// </summary>
        private readonly IDatabaseConnection _connection = connection;

        /// <summary>
        /// The logger helper.
        /// </summary>
        private readonly ILoggerService _loggerService = loggerService;

        /// <summary>
        /// Opens the connection to the database.
        /// </summary>
        public void Open()
        {
            _connection.Open();
            _loggerService.LogInformation("HorrorTracker database is open.");
        }

        /// <summary>
        /// Closes the connection to the database.
        /// </summary>
        public void Close()
        {
            _connection.Close();
            _loggerService.LogInformation("HorrorTracker database is closed.");
        }
    }
}