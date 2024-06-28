using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Shared
{
    [ExcludeFromCodeCoverage]
    public static class PropertyCollector
    {
        /// <summary>
        /// Retrieves the null properties from a model class.
        /// </summary>
        public static List<string> RetrieveNullProperties(object classObject)
        {
            var properties = classObject.GetType().GetProperties();
            return properties.Where(p => p.GetValue(classObject) == null).Select(p => p.Name).ToList();
        }
    }
}