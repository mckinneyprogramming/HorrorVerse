using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="SharedDatabaseParameters"/> class.
    /// </summary>
    public static class SharedDatabaseParameters
    {
        /// <summary>
        /// Retrievs the get by title parameters.
        /// </summary>
        /// <param name="title">The title.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> GetByTitleParameters(string title)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "@Title", title }
            });
        }
    }
}