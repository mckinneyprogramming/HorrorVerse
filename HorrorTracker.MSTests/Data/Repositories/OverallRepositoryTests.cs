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
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockLoggerService = new Mock<ILoggerService>();
            _repository = new OverallRepository(_mockDatabaseConnection.Object, _mockLoggerService.Object);
            _loggerVerifier = new LoggerVerifier(_mockLoggerService);
        }

        [DataTestMethod]
        [DynamicData(nameof(GetTimeSuccess), DynamicDataSourceType.Method)]
        public void WhenSuccessfulConnectionAndDatabaseCall_ShouldReturnTime(string query, string methodName, decimal expectedReturnValue)
        {
            // Arrange
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteScalar()).Returns(expectedReturnValue);
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, query);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            // Act
            var actualReturnValue = ExecuteRepositoryMethod<decimal>(methodName);

            // Assert
            Assert.AreEqual(expectedReturnValue, actualReturnValue);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyInformationMessage($"Time in the database: {actualReturnValue} was retrieved successfully.");
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is closed.");
        }

        [DataTestMethod]
        [DynamicData(nameof(GetTimeFailure), DynamicDataSourceType.Method)]
        public void GetOverallTime_WhenDatabaseCallFails_ShouldLogMessageAndReturnZero(string query, string methodName, object returnValue, string expectedLogMessage)
        {
            // Arrange
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteScalar()).Returns(returnValue);
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, query);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            // Act
            var actualReturnValue = ExecuteRepositoryMethod<decimal>(methodName);

            // Assert
            Assert.AreEqual(0.0M, actualReturnValue);
            _loggerVerifier.VerifyInformationMessage("HorrorTracker database is open.");
            _loggerVerifier.VerifyWarningMessage(expectedLogMessage);
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