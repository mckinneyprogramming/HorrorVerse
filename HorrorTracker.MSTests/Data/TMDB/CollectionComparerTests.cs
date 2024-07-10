using AutoFixture;
using HorrorTracker.Data.TMDB;
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
            var fixture = new Fixture();
            var searchCollectionOne = fixture.Create<SearchCollection>();
            var searchCollectionTwo = fixture.Create<SearchCollection>();
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
            var fixture = new Fixture();
            var searchCollectionOne = fixture.Create<SearchCollection>();
            var searchCollectionTwo = fixture.Create<SearchCollection>();
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
            var fixture = new Fixture();
            var searchCollection = fixture.Create<SearchCollection>();
            var comparer = new CollectionComparer();

            // Act
            var value = comparer.GetHashCode(searchCollection);

            // Assert
            Assert.IsNotNull(value);
            Assert.IsInstanceOfType<int>(value);
        }
    }
}