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

        private readonly string ErrorMessage = Messages.ExceptionMessage;

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
            _mockSetupManager.SetupException(ErrorMessage);

            // Act
            var actualResult = _repository.Add(documentary);

            // Assert
            Assert.AreEqual(expectedResult, actualResult);
            _loggerVerifier.VerifyErrorMessage($"Error adding documentary '{documentary.Title}'.", ErrorMessage);
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
            _mockSetupManager.SetupException(ErrorMessage);

            // Act
            var actualMessage = _repository.Delete(documentaryId);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, ErrorMessage);
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
            _mockSetupManager.SetupException(ErrorMessage);

            // Act
            var result = _repository.GetAll().ToList();

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count);
            _loggerVerifier.VerifyErrorMessage("Error fetching all of the documentaries.", ErrorMessage);
        }

        [TestMethod]
        public void GetByTitle_WhenSuccessful_ShouldReturnDocumentaryAndLogMessage()
        {
            // Arrange
            var expectedDocumentaryTitle = "Test Documentary";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);

            mockDataReader.SetupSequence(r => r.Read())
                .Returns(true)
                .Returns(false);

            mockDataReader.Setup(reader => reader.GetInt32(It.Is<int>(i => i == 0))).Returns(1);
            mockDataReader.Setup(reader => reader.GetString(It.Is<int>(i => i == 1))).Returns(expectedDocumentaryTitle);
            mockDataReader.Setup(reader => reader.GetDecimal(It.Is<int>(i => i == 2))).Returns(389M);
            mockDataReader.Setup(reader => reader.GetInt32(It.Is<int>(i => i == 3))).Returns(2023);
            mockDataReader.Setup(reader => reader.GetBoolean(It.Is<int>(i => i == 4))).Returns(true);

            // Act
            var actualDocumentary = _repository.GetByTitle(expectedDocumentaryTitle);

            // Assert
            Assert.IsNotNull(actualDocumentary);
            Assert.AreEqual(1, actualDocumentary.Id);
            Assert.AreEqual(expectedDocumentaryTitle, actualDocumentary.Title);
            Assert.AreEqual(389M, actualDocumentary.TotalTime);
            Assert.AreEqual(2023, actualDocumentary.ReleaseYear);
            Assert.IsTrue(actualDocumentary.Watched);

            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, $"Documentary '{actualDocumentary.Title}' was found in the database.");
        }

        [TestMethod]
        public void GetByTitle_WhenDocumentaryDoesNotExistInTheDatabase_ShouldLogMessageAndReturnNull()
        {
            // Arrange
            var documentaryTitle = "Nonexistent Movie";
            var mockDataReader = new Mock<IDataReader>();

            _mockDatabaseConnection.Setup(c => c.CreateCommand()).Returns(_mockDatabaseCommand.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(mockDataReader.Object);
            mockDataReader.Setup(r => r.Read()).Returns(false);

            // Act
            var documentary = _repository.GetByTitle(documentaryTitle);

            // Assert
            Assert.IsNull(documentary);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyWarningMessage($"Documentary '{documentaryTitle}' not found in the database.");
        }

        [TestMethod]
        public void GetByTitle_WhenExceptionIsThrown_ShouldLogErrorMessage()
        {
            // Arrange
            _mockSetupManager.SetupException(ErrorMessage);

            // Act
            var documentary = _repository.GetByTitle("title");

            // Assert
            Assert.IsNull(documentary);
            _loggerVerifier.VerifyErrorMessage("An error occurred while getting the documentary by name.", ErrorMessage);
        }

        [TestMethod]
        public void Update_WhenSuccessful_ShouldReturnAndLogMessage()
        {
            // Arrange
            var documentary = Fixtures.Documentary();
            var expectedMessage = $"Documentary '{documentary.Title}' updated successfully.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(DocumentaryQueries.UpdateDocumentary, 1);

            // Act
            var actualMessage = _repository.Update(documentary);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, actualMessage);
        }

        [TestMethod]
        public void Update_WhenNotSuccessful_ShouldReturnAndLogMessage()
        {
            // Arrange
            var documentary = Fixtures.Documentary();
            var expectedMessage = "Updating documentary was not successful.";
            _mockSetupManager.SetupExecuteNonQueryDatabaseCommand(DocumentaryQueries.UpdateDocumentary, 0);

            // Act
            var actualMessage = _repository.Update(documentary);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
            _loggerVerifier.VerifyInformationMessageDoesNotLog($"Documentary '{documentary.Title}' updated successfully.");
        }

        [TestMethod]
        public void Update_WhenExceptionIsThrown_ShouldLogAndReturnMessage()
        {
            var documentary = Fixtures.Documentary();
            var expectedMessage = $"Error updating documentary '{documentary.Title}'.";
            _mockSetupManager.SetupException(ErrorMessage);

            // Act
            var actualMessage = _repository.Update(documentary);

            // Assert
            Assert.AreEqual(expectedMessage, actualMessage);
            _loggerVerifier.VerifyErrorMessage(actualMessage, ErrorMessage);
        }

        [DataTestMethod]
        [DataRow(true, "Successfully retrieved list of watched documentaries.")]
        [DataRow(false, "Successfully retrieved list of unwatched documentaries.")]
        public void GetUnwatchedOrWatched_WhenSuccessful_ShouldReturnDocumentariesAndLogMessage(bool watched, string expectedMessage)
        {
            // Arrange
            var documentaryOne = Fixtures.Documentary();
            var documentaryTwo = Fixtures.Documentary();
            documentaryOne.Watched = watched;
            documentaryTwo.Watched = watched;
            var expectedListOfDocumentaries = new List<Documentary> { documentaryOne, documentaryTwo };

            SetupMockReaderForDocumentaries(documentaryOne, documentaryTwo);

            // Act
            var actualListOfDocumentaries = _repository.GetUnwatchedOrWatched(watched);

            // Assert
            Assert.IsNotNull(actualListOfDocumentaries);
            Assert.AreEqual(expectedListOfDocumentaries.Count, actualListOfDocumentaries.Count());
            CollectionAssert.AreEqual(expectedListOfDocumentaries, actualListOfDocumentaries.ToList(), new DocumentaryComparer());
            _loggerVerifier.VerifyLoggerInformationMessages(Messages.DatabaseOpened, expectedMessage);
        }

        [DataTestMethod]
        [DataRow(true, "Error fetching watched documentaries.")]
        [DataRow(false, "Error fetching unwatched documentaries.")]
        public void GetUnwatchedOrWatched_WhenExceptionIsThrown_ShouldReturnEmptyListAndLogErrorMessage(bool watched, string expectedMessage)
        {
            // Arrange
            _mockSetupManager.SetupException(Messages.ExceptionMessage);

            // Act
            var result = _repository.GetUnwatchedOrWatched(watched);

            // Assert
            Assert.IsTrue(!result.Any());
            _loggerVerifier.VerifyErrorMessage(expectedMessage, Messages.ExceptionMessage);
        }

        [DataTestMethod]
        [DataRow(DocumentaryQueries.GetTotalTimeOfWatchedDocumentary, 400)]
        [DataRow(DocumentaryQueries.GetTimeLeftOfUnwatchedDocumentary, 100)]
        public void GetTime_WhenSuccessful_ShouldReturnTimeAndLogMessage(string query, int time)
        {
            // Arrange
            var expectedTotalTime = Convert.ToDecimal(time);
            _mockSetupManager.SetupExecuteScalarDatabaseCommand(query, expectedTotalTime);

            // Act
            var actualTotalTime = _repository.GetTime(query);

            // Assert
            Assert.AreEqual(expectedTotalTime, actualTotalTime);
            _loggerVerifier.VerifyInformationMessage(Messages.DatabaseOpened);
        }

        [DataTestMethod]
        [DataRow(DocumentaryQueries.GetTotalTimeOfWatchedDocumentary, "Error fetching total time of watched documentaries.")]
        [DataRow(DocumentaryQueries.GetTimeLeftOfUnwatchedDocumentary, "Error fetching time left of unwatched documentaries.")]
        public void GetTime_WhenExceptionOccurs_ShouldReturnZeroAndLogErrorMessage(string query, string message)
        {
            // Arrange
            _mockSetupManager.SetupException(ErrorMessage);

            // Act
            var result = _repository.GetTime(query);

            // Assert
            Assert.IsTrue(result == 0.0M);
            _loggerVerifier.VerifyErrorMessage(message, ErrorMessage);
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