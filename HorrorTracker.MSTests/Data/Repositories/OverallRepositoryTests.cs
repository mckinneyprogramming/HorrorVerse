using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.MSTests.Shared;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;

namespace HorrorTracker.MSTests.Data.Repositories
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class OverallRepositoryTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDatabaseConnection> _mockDatabaseConnection;
        private Mock<IDatabaseCommand> _mockDatabaseCommand;
        private Mock<ILoggerService> _mockLoggerService;
        private OverallRepository _repository;
        private LoggerVerifier _loggerVerifier;
        private MockSetupManager _mockSetupManager;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockLoggerService = new Mock<ILoggerService>();
            _repository = new OverallRepository(_mockDatabaseConnection.Object, _mockLoggerService.Object);
            _loggerVerifier = new LoggerVerifier(_mockLoggerService);
            _mockSetupManager = new MockSetupManager(_mockDatabaseConnection, _mockDatabaseCommand, _mockLoggerService);
        }

        [DataTestMethod]
        [DynamicData(nameof(GetTimeSuccess), DynamicDataSourceType.Method)]
        public void WhenSuccessfulConnectionAndDatabaseCall_ShouldReturnTime(string query, string methodName, decimal expectedReturnValue)
        {
            // Arrange
            _mockSetupManager.SetupExecuteScalarDatabaseCommand(query, expectedReturnValue);

            // Act
            var actualReturnValue = ExecuteRepositoryMethod<decimal>(methodName);

            // Assert
            Assert.AreEqual(expectedReturnValue, actualReturnValue);
            _loggerVerifier.VerifyLoggerInformationMessages(
                "HorrorTracker database is open.",
                $"Time in the database: {actualReturnValue} was retrieved successfully.",
                "HorrorTracker database is closed.");
        }

        [DataTestMethod]
        [DynamicData(nameof(GetTimeFailure), DynamicDataSourceType.Method)]
        public void WhenDatabaseCallFails_ShouldLogMessageAndReturnZero(string query, string methodName, object returnValue, string expectedLogMessage)
        {
            // Arrange
            _mockSetupManager.SetupExecuteScalarDatabaseCommand(query, returnValue);

            // Act
            var actualReturnValue = ExecuteRepositoryMethod<decimal>(methodName);

            // Assert
            Assert.AreEqual(0.0M, actualReturnValue);
            _loggerVerifier.VerifyLoggerInformationMessages("HorrorTracker database is open.", "HorrorTracker database is closed.");
            _loggerVerifier.VerifyWarningMessage(expectedLogMessage);
        }

        [DataTestMethod]
        [DynamicData(nameof(GetTimeException), DynamicDataSourceType.Method)]
        public void WhenDatabaseCallThrowsException_ShouldLogMessageAndReturnZero(string methodName, string initialMessage, string exceptionMessage)
        {
            // Arrange
            _mockSetupManager.SetupException(exceptionMessage);

            // Act
            var actualReturnValue = ExecuteRepositoryMethod<decimal>(methodName);

            // Assert
            Assert.AreEqual(0.0M, actualReturnValue);
            _loggerVerifier.VerifyErrorMessage(initialMessage, exceptionMessage);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is closed.");
        }

        private static IEnumerable<object[]> GetTimeSuccess()
        {
            yield return new object[] { OverallQueries.RetrieveOverallTime, "GetOverallTime", 600.45M };
            yield return new object[] { OverallQueries.RetrieveOverallTimeLeft, "GetOverallTimeLeft", 371.92M };
        }

        private static IEnumerable<object[]> GetTimeFailure()
        {
            yield return new object[] { OverallQueries.RetrieveOverallTime, "GetOverallTime", "expectedReturnValue", "Time was not a valid decimal." };
            yield return new object[] { OverallQueries.RetrieveOverallTime, "GetOverallTimeLeft", "expectedReturnValue", "Time was not a valid decimal." };
#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            yield return new object[] { OverallQueries.RetrieveOverallTime, "GetOverallTime", null, "Time was not calculated or found in the database." };
            yield return new object[] { OverallQueries.RetrieveOverallTimeLeft, "GetOverallTimeLeft", null, "Time was not calculated or found in the database." };
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.
        }

        private static IEnumerable<object[]> GetTimeException()
        {
            yield return new object[] { "GetOverallTime", "Retrieving the overall time from the database failed.", "Failed to retrieve time from movies." };
            yield return new object[] { "GetOverallTimeLeft", "Retrieving the overall time left from the database failed.", "Failed to retrieve time from movies." };
        }

        private T ExecuteRepositoryMethod<T>(string methodName)
        {
            try
            {
                var methodInfo = typeof(OverallRepository).GetMethod(methodName);
#pragma warning disable CS8600 // Converting null literal or possible null value to non-nullable type.
#pragma warning disable CS8603 // Possible null reference return.
#pragma warning disable CS8602 // Dereference of a possibly null reference.
                return (T)methodInfo.Invoke(_repository, null);
#pragma warning restore CS8602 // Dereference of a possibly null reference.
#pragma warning restore CS8600 // Converting null literal or possible null value to non-nullable type.
            }
            catch (TargetInvocationException ex) when (ex.InnerException != null)
            {
                _mockLoggerService.Object.LogError("Error occurred while invoking repository method.", ex.InnerException);
                return default;
#pragma warning restore CS8603 // Possible null reference return.
            }
            finally
            {
                _mockDatabaseConnection.Verify(db => db.Close(), Times.Once);
            }
        }
    }
}