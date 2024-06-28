using HorrorTracker.Data.PostgreHelpers.Interfaces;
using Npgsql;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.PostgreHelpers
{
    /// <summary>
    /// The <see cref="DatabaseConnection"/> class.
    /// </summary>
    /// <seealso cref="IDatabaseConnection"/>
    [ExcludeFromCodeCoverage]
    public class DatabaseConnection : IDatabaseConnection
    {
        /// <summary>
        /// The connection to a Postgre server.
        /// </summary>
        private readonly NpgsqlConnection _connection;

        /// <summary>
        /// Initializes a new instance of the <see cref="DatabaseConnection"/> class.
        /// </summary>
        /// <param name="connectionString">The connection string.</param>
        public DatabaseConnection(string connectionString)
        {
            _connection = new NpgsqlConnection(connectionString);
        }

        /// <inheritdoc/>
        public void Open()
        {
            _connection.Open();
        }

        /// <inheritdoc/>
        public void Close()
        {
            _connection.Close();
        }

        /// <inheritdoc/>
        public IDatabaseCommand CreateCommand()
        {
            return new DatabaseCommand(_connection.CreateCommand());
        }
    }
}