using HorrorTracker.Data.TMDB;
using HorrorTracker.Data.TMDB.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;

namespace HorrorTracker.MSTests.Data.TMDB
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class MovieDatabaseServiceTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private MovieDatabaseService _service;
        private Mock<IMovieDatabaseConfiguration> _mockConfig;
        private Mock<ITMDbClientWrapper> _mockClient;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockConfig = new Mock<IMovieDatabaseConfiguration>();
            _mockConfig.Setup(c => c.GetApiKey()).Returns("mock_api_key");

            _mockClient = new Mock<ITMDbClientWrapper>();
            _service = new MovieDatabaseService(_mockConfig.Object, _mockClient.Object);
        }

        [TestMethod]
        public async Task SearchCollection_ShouldReturnSearchContainer()
        {
            // Arrange
            string seriesTitle = "Test Series";
            var expectedSearchResult = new SearchContainer<SearchCollection>();

            _mockClient.Setup(c => c.SearchCollectionAsync(seriesTitle, It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedSearchResult);

            // Act
            var result = await _service.SearchCollection(seriesTitle);

            // Assert
            Assert.AreEqual(expectedSearchResult, result);
        }

        [TestMethod]
        public async Task GetCollection_ShouldReturnCollection()
        {
            // Arrange
            int seriesId = 123;
            var expectedCollection = new Collection();

            _mockClient.Setup(c => c.GetCollectionAsync(seriesId, It.IsAny<CollectionMethods>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedCollection);

            // Act
            var result = await _service.GetCollection(seriesId);

            // Assert
            Assert.AreEqual(expectedCollection, result);
        }

        [TestMethod]
        public async Task GetMovie_ShouldReturnMovie()
        {
            // Arrange
            int movieId = 456;
            var expectedMovie = new Movie();

            _mockClient.Setup(c => c.GetMovieAsync(movieId, It.IsAny<MovieMethods>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedMovie);

            // Act
            var result = await _service.GetMovie(movieId);

            // Assert
            Assert.AreEqual(expectedMovie, result);
        }
    }
}