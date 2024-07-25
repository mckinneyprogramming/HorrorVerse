using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.MSTests.Shared;
using HorrorTracker.MSTests.Shared.Comparers;
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
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void Add_WhenSuccessful_ShouldReturnOneAndLogMessage()
        {
            // Arrange
            var movie = Fixtures.Movie();
            var expectedResult = 1;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.InsertMovie, expectedResult);

            // Act
            var actualResult = _repository.Add(movie);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, $"Movie '{movie.Title}' was added successfully.");
        }

        [TestMethod]
        public void Add_WhenNotSuccessful_ShouldReturnZeroAndLogMessage()
        {
            // Arrange
            var movie = Fixtures.Movie();
            var expectedResult = 0;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.InsertMovie, expectedResult);

            // Act
            var actualResult = _repository.Add(movie);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
        }

        [TestMethod]
        public void Add_WhenExceptionIsThrown_ShouldReturnZeroAndLogError()
        {
            // Arrange
            var movie = Fixtures.Movie();
            var expectedResult = 0;
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var actualResult = _repository.Add(movie);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyErrorMessage($"Error adding movie '{movie.Title}'.", Messages.ExceptionMessage);
        }

        [TestMethod]
        public void Delete_WhenMovieExistsInTheDatabase_ShouldReturnCorrectMessage()
        {
            // Arrange
            var id = Fixtures.Movie().Id;
            var expectedMessage = $"Movie with ID '{id}' deleted successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.DeleteMovie, 1);

            // Act
            var actualMessage = _repository.Delete(id);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, actualMessage);
        }

        [TestMethod]
        public void Delete_WhenMovieDoesNotExistInTheDatabase_ShouldReturnCorrectMessage()
        {
            // Arrange
            var id = Fixtures.Movie().Id;
            var expectedMessage = "Deleting movie was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.DeleteMovie, 0);

            // Act
            var actualMessage = _repository.Delete(id);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
        }

        [TestMethod]
        public void Delete_WhenErrorOccurs_ShouldReturnCorrectMessage()
        {
            // Arrange
            var id = Fixtures.Movie().Id;
            var expectedMessage = $"Error deleting movie with ID '{id}'.";
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var actualMessage = _repository.Delete(id);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(expectedMessage, Messages.ExceptionMessage);
        }

        [TestMethod]
        public void GetAll_WhenSuccessful_ShouldReturnCorrectListOfMoviesAndLogMessages()
        {
            // Arrange
            var movieOne = Fixtures.Movie();
            var movieTwo = Fixtures.Movie();
            var expectedListOfMovies = new List<Movie>
            {
                movieOne,
                movieTwo
            };

            SetupMockReaderForMovies(movieOne, movieTwo);

            // Act
            var actualResult = _repository.GetAll().ToList();

            // Assert
            Assert.IsNotNull(actualResult);
            Assert.AreEqual(expectedListOfMovies.Count, actualResult.Count());
            CollectionAssert.AreEqual(expectedListOfMovies, actualResult, new MovieComparer());
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, "Successfully retrieved all of the movies.");
        }

        [TestMethod]
        public void GetAll_WhenExceptionIsThrown_ShouldLogErrorMessageAndReturnEmptyList()
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var result = _repository.GetAll();

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count());
            _loggerVerifier.VerifyErrorMessage("Error fetching all of the movies.", Messages.ExceptionMessage);
        }

        [TestMethod]
        public void GetByTitle_WhenSuccessful_ShouldReturnMovieAndLogMessage()
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
            var returnedMovie = _repository.GetByTitle(movieName);

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
                Messages.DatabaseOpened,
                $"Movie '{returnedMovie.Title}' was found in the database.");
        }

        [TestMethod]
        public void GetByTitle_WhenMovieDoesNotExistInTheDatabase_ShouldReturnNullAndLogWarning()
        {
            // Arrange
            var movieName = "Nonexistent Movie";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);
            mockDataReader.Setup(r => r.Read()).Returns(false);

            // Act
            var returnedMovie = _repository.GetByTitle(movieName);

            // Assert
            Assert.IsNull(returnedMovie);
            _loggerVerifier.VerifyWarningMessage($"Movie '{movieName}' not found in the database.");
        }

        [TestMethod]
        public void GetByTitle_WhenExceptionIsCaught_ShouldLogError()
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var returnedMovie = _repository.GetByTitle("movie");

            // Assert
            Assert.IsNull(returnedMovie);
            _loggerVerifier.VerifyErrorMessage("An error occurred while getting the movie by name.", Messages.ExceptionMessage);
        }

        [TestMethod]
        public void Update_WhenProvidedWithMovieAndSuccessful_ShouldReturnAndLogMessage()
        {
            // Arrange
            var movie = Fixtures.Movie();
            var expectedMessage = $"Movie '{movie.Title}' updated successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.UpdateMovie, 1);

            // Act
            var actualMessage = _repository.Update(movie);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(
                Messages.DatabaseOpened,
                actualMessage);
        }

        [TestMethod]
        public void Update_WhenUnsuccessful_ShouldReturnAndLogMessage()
        {
            // Arrange
            var expectedMessage = "Updating movie was not successful.";
            var movie = Fixtures.Movie();
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(MovieQueries.UpdateMovie, 0);

            // Act
            var actualMessage = _repository.Update(movie);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyInformationMessageDoesNotLog($"Movie '{movie.Title}' updated successfully.");
        }

        [TestMethod]
        public void Update_WhenExceptionOccurs_ShouldReturnAndLogErrorMessage()
        {
            // Arrange
            var movie = Fixtures.Movie();
            var expectedMessage = $"Error updating movie '{movie.Title}'.";
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var actualMessage = _repository.Update(movie);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, Messages.ExceptionMessage);
        }

        [DataTestMethod]
        [DataRow(true, "Successfully retrieved list of watched movies.")]
        [DataRow(false, "Successfully retrieved list of unwatched movies.")]
        public void GetUnwatchedOrWatchedMovies_WhenSuccessful_ShouldReturnListOfMovies(bool watched, string message)
        {
            // Arrange
            var movieOne = Fixtures.Movie();
            var movieTwo = Fixtures.Movie();
            movieOne.Watched = watched;
            movieTwo.Watched = watched;

            var expectedListOfMovies = new List<Movie>
            {
                movieOne,
                movieTwo
            };

            SetupMockReaderForMovies(movieOne, movieTwo);

            // Act
            var actualListOfMovies = _repository.GetUnwatchedOrWatchedMovies(watched);

            // Assert
            Assert.IsNotNull(actualListOfMovies);
            Assert.AreEqual(expectedListOfMovies.Count, actualListOfMovies.Count());
            CollectionAssert.AreEqual(expectedListOfMovies, actualListOfMovies.ToList(), new MovieComparer());
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, message);
        }

        [DataTestMethod]
        [DataRow(true, "Error fetching watched movies.")]
        [DataRow(false, "Error fetching unwatched movies.")]
        public void GetUnwatchedOrWatchedMovies_WhenNotSuccessful_ShouldReturnEmptyListAndLogError(bool watched, string errorMessage)
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var result = _repository.GetUnwatchedOrWatchedMovies(watched);

            // Assert
            Assert.IsTrue(!result.Any());
            _loggerVerifier.VerifyErrorMessage(errorMessage, Messages.ExceptionMessage);
        }

        [DataTestMethod]
        [DataRow(MovieQueries.GetTotalTimeOfWatchedMovie, 400)]
        [DataRow(MovieQueries.GetTimeLeftOfUnwatchedMovie, 500)]
        public void GetTime_WhenSuccessful_ShouldReturnCorrectDecimalAndLogMessage(string query, int time)
        {
            // Arrange
            var expectedReturnValue = Convert.ToDecimal(time);
            _mockSetupManager.SetupExecuteScalarDatabaseCommand(query, expectedReturnValue);

            // Act
            var actualReturnValue = _repository.GetTime(query);

            // Assert
            Assert.AreEqual(expectedReturnValue, actualReturnValue);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
        }

        [DataTestMethod]
        [DataRow(MovieQueries.GetTotalTimeOfWatchedMovie, "Error fetching total time of watched movies.")]
        [DataRow(MovieQueries.GetTimeLeftOfUnwatchedMovie, "Error fetching time left of unwatched movies.")]
        public void GetTime_WhenExceptionOccurs_ShouldReturnZeroAndLogError(string query, string errorMessage)
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var result = _repository.GetTime(query);

            // Assert
            Assert.IsTrue(result == 0.0M);
            _loggerVerifier.VerifyErrorMessage(errorMessage, Messages.ExceptionMessage);
        }

        [DataTestMethod]
        [DataRow(true, "Successfully retrieved list of watched movies in the series.")]
        [DataRow(false, "Successfully retrieved list of unwatched movies in the series.")]
        public void GetUnwatchedOrWatchedMoviesInSeries_WhenSuccessful_ShouldReturnListOfMovies(bool watched, string message)
        {
            // Arrange
            var movieSeries = Fixtures.MovieSeries();
            var movieOne = Fixtures.Movie();
            var movieTwo = Fixtures.Movie();
            var expectedListOfMovies = new List<Movie> { movieOne, movieTwo };
            AssignMoviesToSeries(watched, movieSeries.Id, movieOne, movieTwo);
            SetupMockReaderForMovies(movieOne, movieTwo);

            // Act
            var actualListOfMovies = _repository.GetUnwatchedOrWatchedMoviesInSeries(watched, movieSeries.Title);

            // Assert
            Assert.IsNotNull(actualListOfMovies);
            Assert.AreEqual(expectedListOfMovies.Count, actualListOfMovies.Count());
            CollectionAssert.AreEqual(expectedListOfMovies, actualListOfMovies.ToList(), new MovieComparer());
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, message);
        }

        [DataTestMethod]
        [DataRow(true, "Error fetching watched movies in a series.")]
        [DataRow(false, "Error fetching unwatched movies in a series.")]
        public void GetUnwatchedOrWatchedMoviesInSeries_WhenNotSuccessful_ShouldReturnEmptyListOfMoviesAndLogErrorMessage(bool watched, string message)
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var result = _repository.GetUnwatchedOrWatchedMoviesInSeries(watched, "Test Series");

            // Assert
            Assert.IsTrue(!result.Any());
            _loggerVerifier.VerifyErrorMessage(message, Messages.ExceptionMessage);
        }

        private void SetupMockReaderForMovies(Movie movieOne, Movie movieTwo)
        {
            var mockReader = new Mock<IDataReader>();
            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockReader.Object);
            mockReader.SetupSequence(reader => reader.Read())
                      .Returns(true)
                      .Returns(true)
                      .Returns(false);
            mockReader.SetupSequence(reader => reader.GetInt32(0)).Returns(movieOne.Id).Returns(movieTwo.Id);
            mockReader.SetupSequence(reader => reader.GetString(1)).Returns(movieOne.Title).Returns(movieTwo.Title);
            mockReader.SetupSequence(reader => reader.GetDecimal(2)).Returns(movieOne.TotalTime).Returns(movieTwo.TotalTime);
            mockReader.SetupSequence(reader => reader.GetBoolean(3)).Returns(movieOne.PartOfSeries).Returns(movieTwo.PartOfSeries);
#pragma warning disable CS8629 // Nullable value type may be null.
            _ = mockReader.SetupSequence(reader => reader.GetInt32(4)).Returns((int)movieOne.SeriesId).Returns((int)movieTwo.SeriesId);
#pragma warning restore CS8629 // Nullable value type may be null.
            mockReader.SetupSequence(reader => reader.GetInt32(5)).Returns(movieOne.ReleaseYear).Returns(movieTwo.ReleaseYear);
            mockReader.SetupSequence(reader => reader.GetBoolean(6)).Returns(movieOne.Watched).Returns(movieTwo.Watched);
        }

        private static void AssignMoviesToSeries(bool watched, int seriesId, Movie movieOne, Movie movieTwo)
        {
            movieOne.PartOfSeries = true;
            movieOne.SeriesId = seriesId;
            movieOne.Watched = watched;
            movieTwo.PartOfSeries = true;
            movieTwo.SeriesId = seriesId;
            movieTwo.Watched = watched;
        }
    }
}