using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using Moq;
using System.Data;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Helpers
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class DatabaseCommandsHelperTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDatabaseConnection> _mockDatabaseConnection;
        private Mock<IDatabaseCommand> _mockDatabaseCommand;
        private Mock<IDataReader> _mockDataReader;
        private string _commandText;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDatabaseConnection = new Mock<IDatabaseConnection>();
            _mockDatabaseCommand = new Mock<IDatabaseCommand>();
            _mockDataReader = new Mock<IDataReader>();

            _commandText = MovieSeriesQueries.GetAllSeries;

            _mockDatabaseConnection.Setup(db => db.Open());
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteScalar()).Returns(1);
            _mockDatabaseCommand.Setup(cmd => cmd.ExecuteReader()).Returns(_mockDataReader.Object);
            _mockDatabaseCommand.Setup(cmd => cmd.AddParameter(It.IsAny<string>(), It.IsAny<object>()));
            _mockDatabaseCommand.SetupProperty(cmd => cmd.CommandText, _commandText);
            _mockDatabaseConnection.Setup(db => db.CreateCommand()).Returns(_mockDatabaseCommand.Object);

            _mockDataReader.SetupSequence(r => r.Read())
                .Returns(true)
                .Returns(false);
        }

        [TestMethod]
        public void ExecutesScalar_WhenHasParameters_ShouldReturnCommandCode()
        {
            // Arrange
            var parameters = new Dictionary<string, object>
            {
                { "string", "string" }
            }.AsReadOnly();

            // Act
            var result = DatabaseCommandsHelper.ExecutesScalar(_mockDatabaseConnection.Object, _commandText, parameters);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(1, result);
        }

        [TestMethod]
        public void ExecutesScalar_WhenDoesNotHaveParameters_ShouldReturnCommandCode()
        {
            // Arrange

            // Act
            var result = DatabaseCommandsHelper.ExecutesScalar(_mockDatabaseConnection.Object, _commandText);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual(1, result);
        }

        [TestMethod]
        public void ExecutesReader_WhenHasParameters_ShouldReturnRead()
        {
            // Arrange
            var parameters = new Dictionary<string, object>
            {
                { "string", "string" }
            }.AsReadOnly();

            // Act
            var reader = DatabaseCommandsHelper.ExecutesReader(_mockDatabaseConnection.Object, _commandText, parameters);

            // Assert
            Assert.IsNotNull(reader);
            Assert.IsTrue(reader.Read());
        }

        [TestMethod]
        public void ExecutesReader_WhenDoesNotHaveParameters_ShouldReturnRead()
        {
            // Arrange

            // Act
            var reader = DatabaseCommandsHelper.ExecutesReader(_mockDatabaseConnection.Object, _commandText);

            // Assert
            Assert.IsNotNull(reader);
            Assert.IsTrue(reader.Read());
        }

        [DataTestMethod]
        [DataRow(null, false)]
        [DataRow(1, true)]
        public void IsSuccessfulResult_WhenNullAndOneArePassedIn_ShouldReturnCorrectResult(object? result, bool expectedReturnValue)
        {
            // Arrange

            // Act
            var actualReturnValue = DatabaseCommandsHelper.IsSuccessfulResult(result);

            // Assert
            Assert.AreEqual(expectedReturnValue, actualReturnValue);
        }
    }
}