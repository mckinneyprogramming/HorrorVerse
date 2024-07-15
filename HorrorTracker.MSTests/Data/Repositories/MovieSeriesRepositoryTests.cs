using AutoFixture;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using Moq;
using System.Data;
using System.Diagnostics.CodeAnalysis;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.MSTests.Shared;

namespace HorrorTracker.MSTests.Data.Repositories
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class MovieSeriesRepositoryTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDatabaseConnection> _mockDatabaseConnection;
        private Mock<IDatabaseCommand> _mockDatabaseCommand;
        private Mock<ILoggerService> _mockLoggerService;
        private MovieSeriesRepository _repository;
        private LoggerVerifier _loggerVerifier;
        private MockSetupManager _mockSetupManager;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockLoggerService = new Mock<ILoggerService>();
            _repository = new MovieSeriesRepository(_mockDatabaseConnection.Object, _mockLoggerService.Object);
            _loggerVerifier = new LoggerVerifier(_mockLoggerService);
            _mockSetupManager = new MockSetupManager(_mockDatabaseConnection, _mockDatabaseCommand, _mockLoggerService);
        }

        [TestCleanup]
        public void Cleanup()
        {
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is closed.");
        }

        [TestMethod]
        public void AddMovieSeries_SuccessfulConnectionAndAddition_ShouldReturnGoodStatus()
        {
            // Arrange
            var movieSeries = MovieSeries();
            var expectedReturnStatus = 1;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.InsertSeries, expectedReturnStatus);

            // Act
            var actualReturnStatus = _repository.Add(movieSeries);

            // Assert
            Assert.AreEqual(expectedReturnStatus, actualReturnStatus);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                $"Movie series {movieSeries.Title} was added successfully.");
        }

        [TestMethod]
        public void AddMovieSeries_SuccessfulConnectionAndDBNullResult_ShouldReturnZero()
        {
            // Arrange
            var expectedReturnStatus = 0;
            var movieSeries = MovieSeries();
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.InsertSeries, expectedReturnStatus);

            // Act
            var actualReturnStatus = _repository.Add(movieSeries);

            // Assert
            Assert.AreEqual(expectedReturnStatus, actualReturnStatus);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
        }

        [TestMethod]
        public void AddMovieSeries_WhenExceptionOccurs_ShouldLogMessageAndReturnZero()
        {
            // Arrange
            var movieSeries = MovieSeries();
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var returnStatus = _repository.Add(movieSeries);

            // Assert
            Assert.IsTrue(returnStatus == 0);
            _loggerVerifier.VerifyErrorMessage("Adding a movie series to the database failed.", exceptionMessage);
        }

        [TestMethod]
        public void GetMovieSeriesByName_ReturnsMovieSeries_WhenSeriesExists()
        {
            // Arrange
            var seriesName = "Test Series";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);

            mockDataReader.SetupSequence(r => r.Read())
                .Returns(true)
                .Returns(false);

            mockDataReader.Setup(r => r.GetInt32(It.Is<int>(i => i == 0))).Returns(1);
            mockDataReader.Setup(r => r.GetString(It.Is<int>(i => i == 1))).Returns(seriesName);
            mockDataReader.Setup(r => r.GetDecimal(It.Is<int>(i => i == 2))).Returns(400);
            mockDataReader.Setup(r => r.GetInt32(It.Is<int>(i => i == 3))).Returns(11);
            mockDataReader.Setup(r => r.GetBoolean(It.Is<int>(i => i == 4))).Returns(false);

            // Act
            var returnedMovieSeries = _repository.GetByTitle(seriesName);

            // Assert
            Assert.IsNotNull(returnedMovieSeries);
            Assert.AreEqual(1, returnedMovieSeries.Id);
            Assert.AreEqual(seriesName, returnedMovieSeries.Title);
            Assert.AreEqual(400, returnedMovieSeries.TotalTime);
            Assert.AreEqual(11, returnedMovieSeries.TotalMovies);
            Assert.IsFalse(returnedMovieSeries.Watched);

            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                $"Movie series {seriesName} was found in the database.");
        }

        [TestMethod]
        public void GetMovieSeriesByName_ReturnsNull_WhenSeriesDoesNotExist()
        {
            // Arrange
            var seriesName = "Nonexistent Series";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);
            mockDataReader.Setup(r => r.Read()).Returns(false);

            // Act
            var returnedMovieSeries = _repository.GetByTitle(seriesName);

            // Assert
            Assert.IsNull(returnedMovieSeries);
            _loggerVerifier.VerifyWarningMessage($"Movie series {seriesName} was not found in the database.");
        }

        [TestMethod]
        public void GetMovieSeriesByName_WhenExceptionOccurs_ShouldLogMessageAndReturnNull()
        {
            // Arrange
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var returnStatus = _repository.GetByTitle("movieSeries");

            // Assert
            Assert.IsNull(returnStatus);
            _loggerVerifier.VerifyErrorMessage("An error occurred while getting the movie series by name.", exceptionMessage);
        }

        [TestMethod]
        public void UpdateMovieSeries_SuccessfulUpdate_LogsInformation()
        {
            // Arrange
            var expectedMessage = "Series updated successfully.";
            var series = MovieSeries();
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateMovieSeries, 1);

            // Act
            var actualMessage = _repository.Update(series);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                actualMessage);
        }

        [TestMethod]
        public void UpdateMovieSeries_UnsuccessfulUpdate_DoesNotLogInformation()
        {
            // Arrange
            var expectedMessage = "Updating movie series was not successful.";
            var series = MovieSeries();
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateMovieSeries, 0);

            // Act
            var actualMessage = _repository.Update(series);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyInformationMessageDoesNotLog($"Series '{series.Title}' updated successfully.");
        }

        [TestMethod]
        public void UpdateMovieSeries_WhenExceptionOccurs_ShouldLogMessage()
        {
            // Arrange
            var movieSeries = MovieSeries();
            var expectedMessage = $"Error updating series '{movieSeries.Title}'.";
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualMessage = _repository.Update(movieSeries);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, exceptionMessage);
        }

        [TestMethod]
        public void DeleteMovieSeries_SuccessfulDelete_LogsInformation()
        {
            // Arrange
            var expectedMessage = "Series with ID '1' deleted successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.DeleteMovieSeries, 1);

            // Act
            var actualMessage = _repository.Delete(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                actualMessage);
        }

        [TestMethod]
        public void DeleteMovieSeries_UnsuccessfulUpdate_DoesNotLogInformation()
        {
            // Arrange
            var expectedMessage = "Deleting movie series was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.DeleteMovieSeries, 0);

            // Act
            var actualMessage = _repository.Delete(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyInformationMessageDoesNotLog("Series with ID '1' deleted successfully.");
        }

        [TestMethod]
        public void DeleteMovieSeries_WhenExceptionOccurs_ShouldLogMessage()
        {
            // Arrange
            var exceptionMessage = "Failed for not able to connect to the server.";
            var expectedMessage = "Error deleting series with ID '1'.";
            _mockDatabaseConnection.Setup(db => db.Open()).Throws(new Exception(exceptionMessage));
            _mockLoggerService.Setup(x => x.LogError(It.IsAny<string>(), It.IsAny<Exception>()));

            // Act
            var actualMessage = _repository.Delete(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, exceptionMessage);
        }

        [DataTestMethod]
        [DataRow(true, MovieSeriesQueries.GetWatchedMovieSeries)]
        [DataRow(false, MovieSeriesQueries.GetUnwatchedMovieSeries)]
        public void GetUnwatchedOrWatchedMoviesBySeriesName_WhenValidSeriesName_ShouldReturnsWatchedMovies(bool watched, string query)
        {
            // Arrange
            var seriesName = "Test Series";
            var mockReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockReader.Object);
            mockReader.SetupSequence(r => r.Read())
                .Returns(true)
                .Returns(false);
            mockReader.Setup(r => r.GetString(1)).Returns(seriesName);
            mockReader.Setup(r => r.GetDecimal(2)).Returns(120m);
            mockReader.Setup(r => r.GetInt32(3)).Returns(4);
            mockReader.Setup(r => r.GetBoolean(4)).Returns(watched);
            mockReader.Setup(r => r.GetInt32(0)).Returns(1);

            // Act
            var result = _repository.GetUnwatchedOrWatchedByName(seriesName, query);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(1, result.Count());
            Assert.AreEqual(seriesName, result.First().Title);
            Assert.AreEqual(watched, result.First().Watched);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                $"Retrieved {result.Count()} movie series(s) successfully.");
        }

        [DataTestMethod]
        [DataRow(MovieSeriesQueries.GetWatchedMovieSeries)]
        [DataRow(MovieSeriesQueries.GetUnwatchedMovieSeries)]
        public void GetUnwatchedOrWatchedMoviesBySeriesName_WhenExceptionOccurs_ShouldHandleException(string query)
        {
            // Arrange
            var seriesName = "Test Series";
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var result = _repository.GetUnwatchedOrWatchedByName(seriesName, query);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count());
            _loggerVerifier.VerifyErrorMessage($"Error fetching series's '{seriesName}'.", exceptionMessage);
        }

        [TestMethod]
        public void UpdateTotalTime_WhenSuccessful_ShouldReturnMessageAndLogAppropriateMessage()
        {
            // Arrange
            var expectedMessage = "Total time for series ID '1' updated successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateTotalTime, 1);

            // Act
            var actualMessage = _repository.UpdateTotalTime(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                actualMessage);
        }

        [TestMethod]
        public void UpdateTotalTime_WhenUnsuccessful_ShouldReturnAndLogAppropriateMessage()
        {
            // Arrange
            var expectedMessage = "Updating total time for the series was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateTotalTime, 0);

            // Act
            var actualMessage = _repository.UpdateTotalTime(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyInformationMessageDoesNotLog("Total time for series ID '1' updated successfully.");
        }

        [TestMethod]
        public void UpdateTotalTime_WhenExceptionIsThrown_ShouldReturnAndLogExceptionMessage()
        {
            // Arrange
            var expectedMessage = "Error updating total time for series ID '1'.";
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualMessage = _repository.UpdateTotalTime(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, exceptionMessage);
        }

        [TestMethod]
        public void UpdateTotalMovies_WhenSuccessful_ShouldReturnAndLogAppropriateMessage()
        {
            // Arrange
            var expectedMessage = "Total movies for series ID '1' updated successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateTotalMovies, 1);

            // Act
            var actualMessage = _repository.UpdateTotalMovies(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                actualMessage);
        }

        [TestMethod]
        public void UpdateTotalMovies_WhenUnsuccessful_ShouldReturnAndLogAppropriateMessage()
        {
            // Arrange
            var expectedMessage = "Updating the total movies for the series was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateTotalTime, 0);

            // Act
            var actualMessage = _repository.UpdateTotalMovies(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyInformationMessageDoesNotLog("Total movies for series ID '1' updated successfully.");
        }

        [TestMethod]
        public void UpdateTotalMovies_WhenExceptionIsThrown_ShouldReturnAndLogExceptionMessage()
        {
            // Arrange
            var expectedMessage = "Error updating total movies for series ID '1'.";
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualMessage = _repository.UpdateTotalMovies(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, exceptionMessage);
        }

        [TestMethod]
        public void UpdateWatched_WhenSuccessful_ShouldReturnAndLogAppropriateMessage()
        {
            // Arrange
            var expectedMessage = "Watched status for series ID '1' updated successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateWatched, 1);

            // Act
            var actualMessage = _repository.UpdateWatched(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                actualMessage);
        }

        [TestMethod]
        public void UpdateWatched_WhenUnsuccessful_ShouldReturnAndLogAppropriateMessage()
        {
            // Arrange
            var expectedMessage = "Updating watched for the series was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieSeriesQueries.UpdateTotalTime, 0);

            // Act
            var actualMessage = _repository.UpdateWatched(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyInformationMessageDoesNotLog("Watched status for series ID '1' updated successfully.");
        }

        [TestMethod]
        public void UpdateWatched_WhenExceptionIsThrown_ShouldReturnAndLogErrorMessage()
        {
            // Arrange
            var expectedMessage = "Error updating watched status for series ID '1'.";
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualMessage = _repository.UpdateWatched(1);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, exceptionMessage);
        }

        [TestMethod]
        public void GetTimeLeft_WhenSuccesful_ShouldReturnValueAndLogMessage()
        {
            // Arrange
            var expectedValue = 5.5M;
            _mockSetupManager.SetupExecuteScalarDatabaseCommand(MovieSeriesQueries.GetTimeLeft, expectedValue);

            // Act
            var actualValue = _repository.GetTimeLeft(1);

            // Assert
            Assert.AreEqual(expectedValue, actualValue);
            _loggerVerifier.VerifyInformationMessage("Retrieving time left for movie series was successful.");
        }

        [TestMethod]
        public void GetTimeLeft_WhenExceptionIsThrown_ShouldReturnZeroAndLogMessage()
        {
            // Arrange
            var expectedValue = 0.0M;
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualValue = _repository.GetTimeLeft(1);

            // Assert
            Assert.AreEqual(expectedValue, actualValue);
            _loggerVerifier.VerifyErrorMessage("Error fetching time left for series ID '1'.", exceptionMessage);
        }

        [TestMethod]
        public void GetAllMovieSeries_WhenSuccessful_ShouldReturnAllMovieSeriesAndLogMessage()
        {
            // Arrange
            var mockReader = new Mock<IDataReader>();
            var expectedSeriesList = new List<MovieSeries>
            {
                new("Series1", 100, 5, true, 1),
                new("Series2", 200, 10, false, 2)
            };

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockReader.Object);
            mockReader.SetupSequence(reader => reader.Read())
                      .Returns(true)
                      .Returns(true)
                      .Returns(false);
            mockReader.SetupSequence(reader => reader.GetInt32(0))
                .Returns(1)
                .Returns(2);
            mockReader.SetupSequence(reader => reader.GetString(1))
                .Returns("Series1")
                .Returns("Series2");
            mockReader.SetupSequence(reader => reader.GetInt32(2))
                .Returns(100)
                .Returns(200);
            mockReader.SetupSequence(reader => reader.GetInt32(3))
                .Returns(5)
                .Returns(10);
            mockReader.SetupSequence(reader => reader.GetBoolean(4))
                .Returns(true)
                .Returns(false);

            // Act
            var result = _repository.GetAll();

            // Assert
            var actualSeriesList = result.ToList();
            Assert.IsNotNull(result);
            Assert.AreEqual(expectedSeriesList.Count, result.Count());
            CollectionAssert.AreEqual(expectedSeriesList, actualSeriesList, new MovieSeriesComparer());
            _loggerVerifier.VerifyInformationMessage("Retrieving all the movie series was successful.");
        }

        [TestMethod]
        public void GetAllMovieSeries_WhenExceptionIsThrown_ShouldLogErrorMessageAndReturnEmptyList()
        {
            // Arrange
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var result = _repository.GetAll();

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count());
            _loggerVerifier.VerifyErrorMessage("Error fetching all movie series.", exceptionMessage);
        }

        private static MovieSeries MovieSeries()
        {
            var fixture = new Fixture();
            return fixture.Create<MovieSeries>();
        }
    }
}