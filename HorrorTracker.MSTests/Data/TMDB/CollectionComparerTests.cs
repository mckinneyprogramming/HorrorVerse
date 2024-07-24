using HorrorTracker.Data.TMDB;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Search;

namespace HorrorTracker.MSTests.Data.TMDB
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class CollectionComparerTests
    {
        [TestMethod]
        public void Equals_WhenBothSearchCollectionsAreEqual_ShouldReturnTrue()
        {
            // Arrange
            var searchCollectionOne = Fixtures.SearchCollection();
            var searchCollectionTwo = Fixtures.SearchCollection();
            searchCollectionTwo.Id = searchCollectionOne.Id;
            var comparer = new CollectionComparer();

            // Act
            var value = comparer.Equals(searchCollectionOne, searchCollectionTwo);

            // Assert
            Assert.IsTrue(value);
        }

        [TestMethod]
        public void Equals_WhenSearchCollectionsAreNotEqual_ShouldReturnFalse()
        {
            // Arrange
            var searchCollectionOne = Fixtures.SearchCollection();
            var searchCollectionTwo = Fixtures.SearchCollection();
            var comparer = new CollectionComparer();

            // Act
            var value = comparer.Equals(searchCollectionOne, searchCollectionTwo);

            // Assert
            Assert.IsFalse(value);
        }

        [TestMethod]
        public void GetHashCode_WhenSearchCollectionIsPassedIn_ShouldReturnHashCode()
        {
            // Arrange
            var searchCollection = Fixtures.SearchCollection();
            var comparer = new CollectionComparer();

            // Act
            var value = comparer.GetHashCode(searchCollection);

            // Assert
            Assert.IsNotNull(value);
            Assert.IsInstanceOfType<int>(value);
        }
    }
}