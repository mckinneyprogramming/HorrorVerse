using HorrorTracker.Data.Constants.Parameters;
using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Constants.Parameters
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class OverallDatabaseParametersTests
    {
        [TestMethod]
        public void DatabaseConnection_WhenCalled_ShouldReturnReadOnlyDictionary()
        {
            // Arrange

            // Act
            var dictionary = OverallDatabaseParameters.DatabaseConnection();

            // Assert
            Assert.IsNotNull(dictionary);
            Assert.IsTrue(dictionary.ContainsKey("dbname"));
            Assert.IsTrue(dictionary.Keys.Count == 1);
            Assert.IsInstanceOfType(dictionary, typeof(ReadOnlyDictionary<string, object>));
        }
    }
}