using HorrorTracker.Data.TMDB;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.TMDB
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class TMDbClientWrapperTests
    {
        private string? _apiKey;
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private TMDbClientWrapper _clientWrapper;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void TestInitialize()
        {
            _apiKey = Environment.GetEnvironmentVariable("TMDBKey");

            _clientWrapper = new TMDbClientWrapper(_apiKey);
        }

        [TestMethod]
        public async Task SearchCollectionAsync_ShouldReturnResults()
        {
            // Arrange
            var query = "Harry Potter";

            // Act
            var result = await _clientWrapper.SearchCollectionAsync(query);

            // Assert
            Assert.IsNotNull(result);
            Assert.IsTrue(result.Results.Count > 0);
        }

        [TestMethod]
        public async Task GetCollectionAsync_ShouldReturnCollection()
        {
            // Arrange
            var collectionId = 1241;

            // Act
            var result = await _clientWrapper.GetCollectionAsync(collectionId);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(collectionId, result.Id);
        }

        [TestMethod]
        public async Task GetMovieAsync_ShouldReturnMovie()
        {
            // Arrange
            var movieId = 671;

            // Act
            var result = await _clientWrapper.GetMovieAsync(movieId);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(movieId, result.Id);
        }
    }
}