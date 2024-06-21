using HorrorTracker.Data.PostgreHelpers.Interfaces;
using System.Collections.ObjectModel;
using System.Data;

namespace HorrorTracker.Data.Helpers
{
    /// <summary>
    /// The <see cref="DatabaseCommandsHelper"/> class.
    /// </summary>
    public static class DatabaseCommandsHelper
    {
        /// <summary>
        /// Executes the command to the database.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="commandText">The command text.</param>
        /// <param name="parameters">The parameters.</param>
        /// <returns>The execute object.</returns>
        public static object? ExecutesScalar(IDatabaseConnection connection, string commandText, ReadOnlyDictionary<string, object> parameters = null)
        {
            var command = CreateCommand(connection, commandText, parameters);
            return command.ExecuteScalar();
        }

        /// <summary>
        /// Executes the reader command to the database.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="commandText">The command text.</param>
        /// <param name="parameters">The parameters.</param>
        /// <returns>The data reader.</returns>
        public static IDataReader ExecutesReader(IDatabaseConnection connection, string commandText, ReadOnlyDictionary<string, object>? parameters = null)
        {
            var cmd = CreateCommand(connection, commandText, parameters);
            return cmd.ExecuteReader();
        }

        /// <summary>
        /// Executes the non-query command to the database.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="commandText">The command text.</param>
        /// <param name="parameters">The parameters.</param>
        /// <returns>The number of rows affected.</returns>
        public static int ExecuteNonQuery(IDatabaseConnection connection, string commandText, ReadOnlyDictionary<string, object>? parameters = null)
        {
            var command = CreateCommand(connection, commandText, parameters);
            return command.ExecuteNonQuery();
        }

        /// <summary>
        /// Checks if the result from the execute is successful.
        /// </summary>
        /// <param name="result">The result.</param>
        /// <returns>True if value is not null; false otherwise.</returns>
        public static bool IsSuccessfulResult(object? result)
        {
            return result != null && result != DBNull.Value;
        }

        /// <summary>
        /// Checks if the result from the execute is successful.
        /// </summary>
        /// <param name="result">The result.</param>
        /// <returns>True or false.</returns>
        public static bool IsSuccessfulResult(bool result)
        {
            return result;
        }

        /// <summary>
        /// Creates the command text and parameters for the command.
        /// </summary>
        /// <param name="connection">The database connection.</param>
        /// <param name="commandText">The command text.</param>
        /// <param name="parameters">The parameters.</param>
        /// <returns>The database command.</returns>
        private static IDatabaseCommand CreateCommand(
            IDatabaseConnection connection,
            string commandText,
            ReadOnlyDictionary<string, object>? parameters)
        {
            var cmd = connection.CreateCommand();
            cmd.CommandText = commandText;

            if (parameters != null)
            {
                foreach (var keyValuePair in parameters)
                {
                    cmd.AddParameter(keyValuePair.Key, keyValuePair.Value);
                }
            }

            return cmd;
        }
    }
}