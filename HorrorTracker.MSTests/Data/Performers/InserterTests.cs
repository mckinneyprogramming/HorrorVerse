using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Performers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Performers
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class InserterTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<RepositoryBase<MovieSeries>> _mockMovieSeriesRepository;
        private Mock<RepositoryBase<Movie>> _mockMovieRepository;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            
        }

        [TestMethod]
        public void MovieSeriesAddedSuccessfully_ReturnsTrue_WhenSeriesDoesNotExist()
        {
            // Arrange
            _mockMovieSeriesRepository = new Mock<RepositoryBase<MovieSeries>>(It.IsAny<IDatabaseConnection>(), It.IsAny<ILoggerService>());
            var fixture = new Fixture();
            var series = fixture.Create<MovieSeries>();
#pragma warning disable CS8600 // Converting null literal or possible null value to non-nullable type.
            _mockMovieSeriesRepository.Setup(repo => repo.GetByTitle(series.Title)).Returns((MovieSeries)null);
#pragma warning restore CS8600 // Converting null literal or possible null value to non-nullable type.
            _mockMovieSeriesRepository.Setup(repo => repo.Add(series)).Returns(1);

            // Act
            var result = Inserter.MovieSeriesAddedSuccessfully(_mockMovieSeriesRepository.Object, series);

            // Assert
            Assert.IsTrue(result);
        }

        [TestMethod]
        public void MovieSeriesAddedSuccessfully_ReturnsFalse_WhenSeriesExists()
        {
            // Arrange
            _mockMovieSeriesRepository = new Mock<RepositoryBase<MovieSeries>>(It.IsAny<IDatabaseConnection>(), It.IsAny<ILoggerService>());
            var fixture = new Fixture();
            var series = fixture.Create<MovieSeries>();
            _mockMovieSeriesRepository.Setup(repo => repo.GetByTitle(series.Title)).Returns(series);

            // Act
            var result = Inserter.MovieSeriesAddedSuccessfully(_mockMovieSeriesRepository.Object, series);

            // Assert
            Assert.IsFalse(result);
        }

        [TestMethod]
        public void MovieAddedSuccessfully_ReturnsTrue_WhenMovieIsAdded()
        {
            // Arrange
            _mockMovieRepository = new Mock<RepositoryBase<Movie>>(It.IsAny<IDatabaseConnection>(), It.IsAny<ILoggerService>());
            var fixture = new Fixture();
            var movie = fixture.Create<Movie>();
            _mockMovieRepository.Setup(repo => repo.Add(movie)).Returns(1);

            // Act
            var result = Inserter.MovieAddedSuccessfully(_mockMovieRepository.Object, movie);

            // Assert
            Assert.IsTrue(result);
        }

        [TestMethod]
        public void MovieAddedSuccessfully_ReturnsFalse_WhenMovieIsNotAdded()
        {
            // Arrange
            _mockMovieRepository = new Mock<RepositoryBase<Movie>>(It.IsAny<IDatabaseConnection>(), It.IsAny<ILoggerService>());
            var fixture = new Fixture();
            var movie = fixture.Create<Movie>();
            _mockMovieRepository.Setup(repo => repo.Add(movie)).Returns(0);

            // Act
            var result = Inserter.MovieAddedSuccessfully(_mockMovieRepository.Object, movie);

            // Assert
            Assert.IsFalse(result);
        }
    }
}