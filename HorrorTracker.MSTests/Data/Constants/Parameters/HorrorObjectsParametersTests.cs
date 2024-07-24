using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.MSTests.Shared;
using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Constants.Parameters
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class HorrorObjectsParametersTests
    {
        [TestMethod]
        public void InsertParameters_WhenProvidedWithHorrorObject_ShouldReturnReadOnlyDictionary()
        {
            // Arrange
            var movieSeries = Fixtures.MovieSeries();

            // Act
            var dictionary = HorrorObjectsParameters.InsertParameters(movieSeries);

            // Assert
            Assert.IsNotNull(dictionary);
            Assert.IsTrue(dictionary.Keys.Count != 0);
            Assert.IsInstanceOfType(dictionary, typeof(ReadOnlyDictionary<string, object>));
        }

        [TestMethod]
        public void UpdateParameters_WhenProvidedWithHorrorObject_ShouldReturnReadOnlyDictionary()
        {
            // Arrange
            var movieSeries = Fixtures.MovieSeries();

            // Act
            var dictionary = HorrorObjectsParameters.UpdateParameters(movieSeries);

            // Assert
            Assert.IsNotNull(dictionary);
            Assert.IsTrue(dictionary.Keys.Count != 0);
            Assert.IsTrue(dictionary.ContainsKey("Id"));
            Assert.IsInstanceOfType(dictionary, typeof(ReadOnlyDictionary<string, object>));
        }

        [TestMethod]
        public void GetByTitleParameters_WhenProvidedWithTitle_ShouldReturnReadOnlyDictionary()
        {
            // Arrange
            var title = "Series Title";

            // Act
            var dictionary = HorrorObjectsParameters.GetByTitleParameters(title);

            // Assert
            Assert.IsNotNull(dictionary);
            Assert.IsTrue(dictionary.Keys.Count == 1);
            Assert.IsTrue(dictionary.ContainsKey("Title"));
            Assert.IsTrue(dictionary.Values.Count == 1);
            Assert.IsInstanceOfType(dictionary, typeof(ReadOnlyDictionary<string, object>));
        }

        [TestMethod]
        public void IdParameters_WhenProvidedWithId_ShouldReturnReadOnlyDictionary()
        {
            // Arrange
            var id = 1;

            // Act
            var dictionary = HorrorObjectsParameters.IdParameters(id);

            // Assert
            Assert.IsNotNull(dictionary);
            Assert.IsTrue(dictionary.Keys.Count == 1);
            Assert.IsTrue(dictionary.ContainsKey("Id"));
            Assert.IsTrue(dictionary.Values.Count == 1);
            Assert.IsInstanceOfType(dictionary, typeof(ReadOnlyDictionary<string, object>));
        }
    }
}