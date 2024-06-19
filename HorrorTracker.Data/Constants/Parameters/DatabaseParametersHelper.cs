using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="DatabaseParametersHelper"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public static class DatabaseParametersHelper
    {
        /// <summary>
        /// Helper method to create a read-only dictionary from a regular dictionary.
        /// </summary>
        /// <param name="dictionary">The dictionary to convert.</param>
        /// <returns>The read-only dictionary.</returns>
        public static ReadOnlyDictionary<string, object> CreateReadOnlyDictionary(Dictionary<string, object> dictionary)
        {
            return new ReadOnlyDictionary<string, object>(dictionary);
        }
    }
}