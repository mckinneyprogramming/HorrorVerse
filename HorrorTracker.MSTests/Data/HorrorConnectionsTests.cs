using HorrorTracker.Data;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.MSTests.Shared;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class HorrorConnectionsTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDatabaseConnection> _mockDatabaseConnection;
        private Mock<IDatabaseCommand> _mockDatabaseCommand;
        private Mock<ILoggerService> _mockLoggerService;
        private LoggerVerifier _loggerVerifier;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockLoggerService = new Mock<ILoggerService>();
            _loggerVerifier = new LoggerVerifier(_mockLoggerService);
        }

        [TestMethod]
        public void Connect_SuccessfulConnection_DatabaseExists()
        {
            // Arrange
            var expectedReturnString = "Connection successful! Database exists on the server.";
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteScalar()).Returns(1);
            _mockDatabaseCommand.Setup(cmd => cmd.AddParameter(It.IsAny<string>(), It.IsAny<object>()));
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, OverallQueries.HorrorTrackerDatabaseConnection);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var actualReturnString = horrorConnections.Connect();

            // Assert
            Assert.AreEqual(expectedReturnString, actualReturnString);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyInformationMessage("The connection to the server was successful and the database exists.");
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void Connect_FailedConnection_ConnectionFailed()
        {
            // Arrange
            var exceptionMessage = "Failed to connect to the database.";
            var expectedReturnString = $"Connection failed: {exceptionMessage}";
            _mockDatabaseConnection.Setup(db => db.Open()).Throws(new Exception(exceptionMessage));
            _mockLoggerService.Setup(x => x.LogError(It.IsAny<string>(), It.IsAny<Exception>()));

            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var actualReturnString = horrorConnections.Connect();

            // Assert
            Assert.AreEqual(expectedReturnString, actualReturnString);
            _loggerVerifier.VerifyErrorMessage("The connection to the Postgre server failed.", exceptionMessage);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void Connect_DatabaseDoesNotExist_ReturnsCorrectMessage()
        {
            // Arrange
            var expectedReturnString = "Connection is successful, but database does not exist on the server.";
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteScalar()).Returns(DBNull.Value);
            _mockDatabaseCommand.Setup(cmd => cmd.AddParameter(It.IsAny<string>(), It.IsAny<object>()));
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, OverallQueries.HorrorTrackerDatabaseConnection);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var actualReturnString = horrorConnections.Connect();

            // Assert
            Assert.AreEqual(expectedReturnString, actualReturnString);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyWarningMessage("The connection to the server was successful, but the HorrorTracker database was not found.");
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void CreateTables__WhenCreatingValidTable_ShouldLogCorrectMessageAndReturnCorrectStatus()
        {
            // Arrange
            var expectedReturnStatus = 1;
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteNonQuery()).Returns(expectedReturnStatus);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var actualReturnStatus = horrorConnections.CreateTables();

            // Assert
            Assert.AreEqual(expectedReturnStatus, actualReturnStatus);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyInformationMessage("All tables were built successfully if they weren't already created.");
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void CreateTables_WhenResultIsNull_ShouldReturnZero()
        {
            // Arrange
            var expectedReturnStatus = 0;
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteNonQuery()).Returns(expectedReturnStatus);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var actualReturnStatus = horrorConnections.CreateTables();

            // Assert
            Assert.AreEqual(expectedReturnStatus, actualReturnStatus);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void CreateTables__WhenExceptionOccurs_ShouldLogCorrectMessageAndReturnCorrectStatus()
        {
            // Arrange
            var expectedResult = 0;
            var exceptionMessage = "Failed for not able to connect to the server.";
            _mockDatabaseConnection.Setup(db => db.Open()).Throws(new Exception(exceptionMessage));
            _mockLoggerService.Setup(x => x.LogError(It.IsAny<string>(), It.IsAny<Exception>()));

            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var actualResult = horrorConnections.CreateTables();

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyErrorMessage("Creating tables in the database failed.", exceptionMessage);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseClosed);
        }

        [TestMethod]
        public void RetrieveOverallRepository_WhenCalled_ShouldReturnOverallRepository()
        {
            // Arrange
            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var value = horrorConnections.RetrieveOverallRepository();

            // Assert
            Assert.IsNotNull(value);
            Assert.IsInstanceOfType(value, typeof(OverallRepository));
        }

        [TestMethod]
        public void RetrieveMovieSeriesRepository_WhenCalled_ShouldReturnMovieSeriesRepository()
        {
            // Arrange
            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var value = horrorConnections.RetrieveMovieSeriesRepository();

            // Assert
            Assert.IsNotNull(value);
            Assert.IsInstanceOfType(value, typeof(MovieSeriesRepository));
        }

        [TestMethod]
        public void RetrieveMovieRepository_WhenCalled_ShouldReturnMovieRepository()
        {
            // Arrange
            var horrorConnections = new HorrorConnections(_mockDatabaseConnection.Object, _mockLoggerService.Object);

            // Act
            var value = horrorConnections.RetrieveMovieRepository();

            // Assert
            Assert.IsNotNull(value);
            Assert.IsInstanceOfType(value, typeof(MovieRepository));
        }
    }
}