using System.Data;

namespace HorrorTracker.Data.PostgreHelpers.Interfaces
{
    /// <summary>
    /// The <see cref="IDatabaseCommand"/> interface.
    /// </summary>
    public interface IDatabaseCommand
    {
        /// <summary>
        /// Gets or sets the CommandText.
        /// </summary>
        string CommandText { get; set; }

        /// <summary>
        /// Executes the command in the database.
        /// </summary>
        /// <returns>The executed command.</returns>
        object? ExecuteScalar();

        /// <summary>
        /// Executes the reader on the database.
        /// </summary>
        /// <returns>The data reader.</returns>
        IDataReader ExecuteReader();

        /// <summary>
        /// Adds the parameter name and object to the command.
        /// </summary>
        /// <param name="parameterName">The parameter name.</param>
        /// <param name="value">The value.</param>
        void AddParameter(string parameterName, object value);
    }
}