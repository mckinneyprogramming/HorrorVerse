using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="OverallDatabaseParameters"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public static class OverallDatabaseParameters
    {
        /// <summary>
        /// Retrieves the parameters to test the database connection.
        /// </summary>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> DatabaseConnection()
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "dbname", "HorrorTracker" }
            });
        }
    }
}