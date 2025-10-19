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
    public class DatabaseConnectionsHelper(IDatabaseConnection connection)
    {
        /// <summary>
        /// The database connection.
        /// </summary>
        private readonly IDatabaseConnection _connection = connection;

        /// <summary>
        /// Opens the connection to the database.
        /// </summary>
        public void Open()
        {
            _connection.Open();
        }

        /// <summary>
        /// Closes the connection to the database.
        /// </summary>
        public void Close()
        {
            _connection.Close();
        }
    }
}