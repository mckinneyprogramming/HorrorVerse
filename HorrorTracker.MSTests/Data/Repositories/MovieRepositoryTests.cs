using AutoFixture;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.MSTests.Shared;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Data;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Repositories
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class MovieRepositoryTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDatabaseConnection> _mockDatabaseConnection;
        private Mock<IDatabaseCommand> _mockDatabaseCommand;
        private Mock<ILoggerService> _mockLoggerService;
        private MovieRepository _repository;
        private LoggerVerifier _loggerVerifier;
        private MockSetupManager _mockSetupManager;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockLoggerService = new Mock<ILoggerService>();
            _repository = new MovieRepository(_mockDatabaseConnection.Object, _mockLoggerService.Object);
            _loggerVerifier = new LoggerVerifier(_mockLoggerService);
            _mockSetupManager = new MockSetupManager(_mockDatabaseConnection, _mockDatabaseCommand, _mockLoggerService);
        }

        [TestCleanup]
        public void Cleanup()
        {
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is closed.");
        }

        [TestMethod]
        public void AddMovie_WhenSuccessful_ShouldReturnOneAndLogMessage()
        {
            // Arrange
            var movie = Movie();
            var expectedResult = 1;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.InsertMovie, expectedResult);

            // Act
            var actualResult = _repository.Add(movie);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyLoggerInformationMessages("HorrorTracker database is open.", $"Movie '{movie.Title}' added successfully.");
        }

        [TestMethod]
        public void AddMovie_WhenNotSuccessful_ShouldReturnZeroAndLogMessage()
        {
            // Arrange
            var movie = Movie();
            var expectedResult = 0;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.InsertMovie, expectedResult);

            // Act
            var actualResult = _repository.Add(movie);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
        }

        [TestMethod]
        public void AddMovie_WhenExceptionIsThrown_ShouldReturnZeroAndLogError()
        {
            // Arrange
            var movie = Movie();
            var expectedResult = 0;
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualResult = _repository.Add(movie);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyErrorMessage($"Error adding movie '{movie.Title}'.", exceptionMessage);
        }

        [TestMethod]
        public void GetMovieByName_WhenSuccessful_ShouldReturnMovieAndLogMessage()
        {
            // Arrange
            var movieName = "Test Movie";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);

            mockDataReader.SetupSequence(r => r.Read())
                .Returns(true)
                .Returns(false);

            mockDataReader.Setup(r => r.GetInt32(It.Is<int>(i => i == 0))).Returns(1);
            mockDataReader.Setup(r => r.GetString(It.Is<int>(i => i == 1))).Returns(movieName);
            mockDataReader.Setup(r => r.GetDecimal(It.Is<int>(i => i == 2))).Returns(1.5M);
            mockDataReader.Setup(r => r.GetBoolean(It.Is<int>(i => i == 3))).Returns(false);
            mockDataReader.Setup(r => r.GetInt32(It.Is<int>(i => i == 4))).Returns(0);
            mockDataReader.Setup(r => r.GetInt32(It.Is<int>(i => i == 5))).Returns(1996);
            mockDataReader.Setup(r => r.GetBoolean(It.Is<int>(i => i == 6))).Returns(true);

            // Act
            var returnedMovie = _repository.GetByName(movieName);

            // Assert
            Assert.IsNotNull(returnedMovie);
            Assert.AreEqual(1, returnedMovie.Id);
            Assert.AreEqual(movieName, returnedMovie.Title);
            Assert.AreEqual(1.5M, returnedMovie.TotalTime);
            Assert.IsFalse(returnedMovie.PartOfSeries);
            Assert.AreEqual(0, returnedMovie.SeriesId);
            Assert.AreEqual(1996, returnedMovie.ReleaseYear);
            Assert.IsTrue(returnedMovie.Watched);

            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                $"Movie '{returnedMovie.Title}' was found in the database.");
        }

        [TestMethod]
        public void GetMovieByName_WhenMovieDoesNotExistInTheDatabase_ShouldReturnNullAndLogWarning()
        {
            // Arrange
            var movieName = "Nonexistent Movie";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);
            mockDataReader.Setup(r => r.Read()).Returns(false);

            // Act
            var returnedMovie = _repository.GetByName(movieName);

            // Assert
            Assert.IsNull(returnedMovie);
            _loggerVerifier.VerifyWarningMessage($"Movie '{movieName}' not found in the database.");
        }

        [TestMethod]
        public void GetMovieByName_WhenExceptionIsCaught_ShouldLogError()
        {
            // Arrange
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var returnedMovie = _repository.GetByName("movie");

            // Assert
            Assert.IsNull(returnedMovie);
            _loggerVerifier.VerifyErrorMessage("An error occurred while getting the movie by name.", exceptionMessage);
        }

        private static Movie Movie()
        {
            var fixture = new Fixture();
            return fixture.Create<Movie>();
        }
    }
}