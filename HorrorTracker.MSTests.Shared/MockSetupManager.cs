using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Shared
{
    [ExcludeFromCodeCoverage]
    public class MockSetupManager
    {
        private readonly Mock<IDatabaseConnection> _mockDatabaseConnection;
        private readonly Mock<IDatabaseCommand> _mockDatabaseCommand;
        private readonly Mock<ILoggerService> _mockLoggerService;

        /// <summary>
        /// Initializes a new instance of the <see cref="MockSetupManager"/> class.
        /// </summary>
        /// <param name="mockDatabaseConnection">The mock database connection.</param>
        /// <param name="mockDatabaseCommand">The mock database command.</param>
        /// <param name="mockLoggerService">The mock logger service.</param>
        public MockSetupManager(
            Mock<IDatabaseConnection> mockDatabaseConnection,
            Mock<IDatabaseCommand> mockDatabaseCommand,
            Mock<ILoggerService> mockLoggerService)
        {
            _mockDatabaseConnection = mockDatabaseConnection;
            _mockDatabaseCommand = mockDatabaseCommand;
            _mockLoggerService = mockLoggerService;
        }

        /// <summary>
        /// Sets up the ExecuteNonQuery database command.
        /// </summary>
        /// <param name="commandText">The command text.</param>
        /// <param name="returnStatus">The return status.</param>
        public void SetupExecuteNonQueryDatabaseCommand(string commandText, int returnStatus)
        {
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteNonQuery()).Returns(returnStatus);
            _mockDatabaseCommand.Setup(cmd => cmd.AddParameter(It.IsAny<string>(), It.IsAny<object>()));
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, commandText);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);
        }

        /// <summary>
        /// Sets up the ExecuteScalar database command.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="returnValue">The return value.</param>
        public void SetupExecuteScalarDatabaseCommand(string query, object returnValue)
        {
            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteScalar()).Returns(returnValue);
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, query);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);
        }

        /// <summary>
        /// Sets up the exception.
        /// </summary>
        /// <param name="exceptionMessage">The exception message.</param>
        public void SetupException(string exceptionMessage)
        {
            _mockDatabaseConnection.Setup(db => db.Open()).Throws(new Exception(exceptionMessage));
            _mockLoggerService.Setup(x => x.LogError(It.IsAny<string>(), It.IsAny<Exception>()));
        }
    }
}