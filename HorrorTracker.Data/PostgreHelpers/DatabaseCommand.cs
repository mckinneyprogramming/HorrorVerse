using HorrorTracker.Data.PostgreHelpers.Interfaces;
using Npgsql;
using System.Data;

namespace HorrorTracker.Data.PostgreHelpers
{
    /// <summary>
    /// The <see cref="DatabaseCommand"/> class.
    /// </summary>
    /// <seealso cref="IDatabaseCommand"/>
    public class DatabaseCommand : IDatabaseCommand
    {
        /// <summary>
        /// The SQL command for the Postgre database.
        /// </summary>
        private readonly NpgsqlCommand _command;

        /// <summary>
        /// Initialzies a new instance of the <see cref="DatabaseCommand"/> class.
        /// </summary>
        /// <param name="command">The SQL command.</param>
        public DatabaseCommand(NpgsqlCommand command)
        {
            _command = command;
        }

        /// <inheritdoc/>
        public string CommandText
        {
            get => _command.CommandText;
            set => _command.CommandText = value;
        }

        /// <inheritdoc/>
        public object? ExecuteScalar()
        {
            return _command.ExecuteScalar();
        }

        /// <inheritdoc/>
        public IDataReader ExecuteReader()
        {
            return _command.ExecuteReader();
        }

        /// <inheritdoc/>
        public int ExecuteNonQuery()
        {
            return _command.ExecuteNonQuery();
        }

        /// <inheritdoc/>
        public void AddParameter(string parameterName, object value)
        {
            _command.Parameters.AddWithValue(parameterName, value);
        }
    }
}