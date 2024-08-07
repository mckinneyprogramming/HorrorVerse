using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.MSTests.Shared;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Repositories
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class DocumentaryRepositoryTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDatabaseConnection> _mockDatabaseConnection;
        private Mock<IDatabaseCommand> _mockDatabaseCommand;
        private Mock<ILoggerService> _mockLoggerService;
        private DocumentaryRepository _repository;
        private LoggerVerifier _loggerVerifier;
        private MockSetupManager _mockSetupManager;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockLoggerService = new Mock<ILoggerService>();
            _repository = new DocumentaryRepository(_mockDatabaseConnection.Object, _mockLoggerService.Object);
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
            var documentary = Fixtures.Documentary();
            var expectedResult = 1;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(DocumentaryQueries.InsertDocumentary, expectedResult);

            // Act
            var actualResult = _repository.Add(documentary);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, $"Documentary '{documentary.Title}' was added successfully.");
        }

        [TestMethod]
        public void Add_WhenNotSuccessful_ShouldReturnZeroAndLogMessage()
        {
            // Arrange
            var documentary = Fixtures.Documentary();
            var expectedResult = 0;
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(DocumentaryQueries.InsertDocumentary, expectedResult);

            // Act
            var actualResult = _repository.Add(documentary);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
        }

        [TestMethod]
        public void Add_WhenExceptionIsThrown_ShouldReturnZeroAndLogError()
        {
            // Arrange
            var documentary = Fixtures.Documentary();
            var expectedResult = 0;
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var actualResult = _repository.Add(documentary);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyErrorMessage($"Error adding documentary '{documentary.Title}'.", Messages.ExceptionMessage);
        }
    }
}