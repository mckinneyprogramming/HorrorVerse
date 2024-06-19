using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Helpers
{
    /// <summary>
    /// The <see cref="DatabaseConnectionsHelper"/> class.
    /// </summary>
    public class DatabaseConnectionsHelper
    {
        /// <summary>
        /// The database connection.
        /// </summary>
        private readonly IDatabaseConnection _connection;

        /// <summary>
        /// The logger helper.
        /// </summary>
        private readonly LoggerHelper _loggerHelper;

        /// <summary>
        /// Initializes a new instance of the <see cref="DatabaseConnectionsHelper"/> class.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="loggerService">The logger service.</param>
        public DatabaseConnectionsHelper(IDatabaseConnection connection, ILoggerService loggerService)
        {
            _connection = connection;
            _loggerHelper = new LoggerHelper(loggerService);
        }

        /// <summary>
        /// Opens the connection to the database.
        /// </summary>
        public void Open()
        {
            _connection.Open();
            _loggerHelper.DatabaseOpened();
        }

        /// <summary>
        /// Closes the connection to the database.
        /// </summary>
        public void Close()
        {
            _connection.Close();
            _loggerHelper.DatabaseClosed();
        }
    }
}