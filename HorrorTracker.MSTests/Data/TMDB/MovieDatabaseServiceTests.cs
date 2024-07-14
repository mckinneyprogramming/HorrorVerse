using HorrorTracker.Data.TMDB;
using HorrorTracker.Data.TMDB.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

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
            _service = new MovieDatabaseService(_mockClient.Object);
        }

        [TestMethod]
        public async Task SearchCollection_ShouldReturnSearchContainer()
        {
            // Arrange
            var seriesTitle = "Test Series";
            var expectedSearchResult = new SearchContainer<SearchCollection>();

            _mockClient.Setup(c => c.SearchCollectionAsync(seriesTitle, It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedSearchResult);

            // Act
            var result = await _service.SearchCollection(seriesTitle);

            // Assert
            Assert.AreEqual(expectedSearchResult, result);
        }

        [TestMethod]
        public async Task SearchMovie_ShouldReturnSerachContainer()
        {
            // Arrange
            var movieTitle = "Test Movie";
            var expectedSerachResult = new SearchContainer<SearchMovie>();

            _mockClient.Setup(c => c.SearchMovieAsync(movieTitle, It.IsAny<int>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedSerachResult);

            // Act
            var actualSerachResult = await _service.SearchMovie(movieTitle);

            // Assert
            Assert.AreEqual(expectedSerachResult, actualSerachResult);
        }

        [TestMethod]
        public async Task SearchTvShow_ShouldReturnSearchContainer()
        {
            // Arrange
            var tvShow = "Test TV Show";
            var expectedSearchResult = new SearchContainer<SearchTv>();

            _mockClient.Setup(c => c.SearchTvShowAsync(tvShow, It.IsAny<int>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedSearchResult);

            // Act
            var actualSearchResult = await _service.SearchTvShow(tvShow);

            // Assert
            Assert.AreEqual(expectedSearchResult, actualSearchResult);
        }

        [TestMethod]
        public async Task GetCollection_ShouldReturnCollection()
        {
            // Arrange
            var seriesId = 123;
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
            var movieId = 456;
            var expectedMovie = new Movie();

            _mockClient.Setup(c => c.GetMovieAsync(movieId, It.IsAny<MovieMethods>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedMovie);

            // Act
            var result = await _service.GetMovie(movieId);

            // Assert
            Assert.AreEqual(expectedMovie, result);
        }

        [TestMethod]
        public async Task GetTvShow_ShouldReturnTvShow()
        {
            // Arrange
            var tvShowId = 123;
            var expectedTvShow = new TvShow();

            _mockClient.Setup(c => c.GetTvShowAsync(tvShowId, It.IsAny<TvShowMethods>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedTvShow);

            // Act
            var actualTvShow = await _service.GetTvShow(tvShowId);

            // Assert
            Assert.AreEqual(expectedTvShow, actualTvShow);
        }

        [TestMethod]
        public async Task GetTvSeason_ShouldReturnTvSeason()
        {
            // Arrange
            var tvShowId = 123;
            var tvSeasonNumber = 1;
            var expectedTvSeason = new TvSeason();

            _mockClient.Setup(c => c.GetTvSeasonAsync(tvShowId, tvSeasonNumber, It.IsAny<TvSeasonMethods>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(expectedTvSeason);

            // Act
            var actualTvSeason = await _service.GetTvSeason(tvShowId, tvSeasonNumber);

            // Assert
            Assert.AreEqual(expectedTvSeason, actualTvSeason);
        }

        [TestMethod]
        public async Task GetTvEpisode_ShouldReturnTvEpisode()
        {
            // Arrange
            var tvShowId = 123;
            var tvSeasonNumber = 1;
            var episodeNumber = 20;
            var expectedTvEpisode = new TvEpisode();

            _mockClient.Setup(c => c.GetTvEpisodeAsync(tvShowId, tvSeasonNumber, episodeNumber, It.IsAny<TvEpisodeMethods>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedTvEpisode);

            // Act
            var actualTvEpisode = await _service.GetTvEpisode(tvShowId, tvSeasonNumber, episodeNumber);

            // Assert
            Assert.AreEqual(expectedTvEpisode, actualTvEpisode);
        }

        [TestMethod]
        public async Task GetHorrorCollections_WhenValidPageNumbersAreProvided_ShouldReturnListOfCollections()
        {
            // Arrange
            var expectedCollection = new HashSet<SearchCollection>();
            _mockClient.Setup(c => c.GetHorrorCollections(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>())).ReturnsAsync(expectedCollection);

            // Act
            var actualCollection = await _service.GetHorrorCollections(1, 5, 27);

            // Assert
            Assert.AreEqual(expectedCollection, actualCollection);
        }

        [TestMethod]
        public async Task GetNumberOfPages_WhenCalledToWrapper_ShouldReturnNunmberOfPagesOfHorrorMovies()
        {
            // Arrange
            var expectedNumberOfPages = 2642;
            _mockClient.Setup(c => c.GetNumberOfPages(It.IsAny<int>())).ReturnsAsync(expectedNumberOfPages);

            // Act
            var actualNumberOfPages = await _service.GetNumberOfPages(It.IsAny<int>());

            // Assert
            Assert.AreEqual(expectedNumberOfPages, actualNumberOfPages);
        }
    }
}