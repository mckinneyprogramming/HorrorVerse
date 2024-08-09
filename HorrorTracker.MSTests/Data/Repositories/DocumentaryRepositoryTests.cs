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

        [TestMethod]
        public void Delete_WhenSuccessful_ShouldReturnMessageAndLogMessage()
        {
            // Arrange
            var documentaryId = Fixtures.Documentary().Id;
            var expectedMessage = $"Documentary with ID '{documentaryId}' deleted successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(DocumentaryQueries.DeleteDocumentary, 1);

            // Act
            var actualMessage = _repository.Delete(documentaryId);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, actualMessage);
        }

        [TestMethod]
        public void Delete_WhenDocumentaryDoesNotExist_ShouldReturnCorrectMessageAndLogMessages()
        {
            // Arrange
            var documentaryId = Fixtures.Documentary().Id;
            var expectedMessage = "Deleting documentary was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(DocumentaryQueries.DeleteDocumentary, 0);

            // Act
            var actualMessage = _repository.Delete(documentaryId);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened);
        }

        [TestMethod]
        public void Delete_WhenExceptionIsThrown_ShouldReturnCorrectMessageAndLogError()
        {
            // Arrange
            var documentaryId = Fixtures.Documentary().Id;
            var expectedMessage = $"Error deleting documentary with ID '{documentaryId}'.";
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var actualMessage = _repository.Delete(documentaryId);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, Messages.ExceptionMessage);
        }

        [TestMethod]
        public void GetAll_WhenSuccessful_ShouldReturnListOfDocumentariesAndLogMessage()
        {
            // Arrange
            var documentaryOne = Fixtures.Documentary();
            var documentaryTwo = Fixtures.Documentary();
            var expectedResult = new List<Documentary>
            {
                documentaryOne,
                documentaryTwo
            };

            SetupMockReaderForDocumentaries(documentaryOne, documentaryTwo);

            // Act
            var actualResult = _repository.GetAll().ToList();

            // Assert
            Assert.IsNotNull(actualResult);
            Assert.AreEqual(expectedResult.Count, actualResult.Count);
            CollectionAssert.AreEqual(expectedResult, actualResult, new DocumentaryComparer());
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, "Successfully retrieved all of the documentaries.");
        }

        [TestMethod]
        public void GetAll_WhenExceptionIsThrown_ShouldLogErrorMessageAndReturnEmptyList()
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var result = _repository.GetAll().ToList();

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count);
            _loggerVerifier.VerifyErrorMessage("Error fetching all of the documentaries.", Messages.ExceptionMessage);
        }

        private void SetupMockReaderForDocumentaries(Documentary documentaryOne, Documentary documentaryTwo)
        {
            var mockReader = new Mock<IDataReader>();
            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockReader.Object);
            mockReader.SetupSequence(reader => reader.Read())
                      .Returns(true)
                      .Returns(true)
                      .Returns(false);

            mockReader.SetupSequence(reader => reader.GetInt32(0)).Returns(documentaryOne.Id).Returns(documentaryTwo.Id);
            mockReader.SetupSequence(reader => reader.GetString(1)).Returns(documentaryOne.Title).Returns(documentaryTwo.Title);
            mockReader.SetupSequence(reader => reader.GetDecimal(2)).Returns(documentaryOne.TotalTime).Returns(documentaryTwo.TotalTime);
            mockReader.SetupSequence(reader => reader.GetInt32(3)).Returns(documentaryOne.ReleaseYear).Returns(documentaryTwo.ReleaseYear);
            mockReader.SetupSequence(reader => reader.GetBoolean(4)).Returns(documentaryOne.Watched).Returns(documentaryTwo.Watched);
        }
    }
}