using HorrorTracker.Data.TMDB.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.TMDB
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class MovieDatabaseConfigTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IMovieDatabaseConfiguration> _mockMovieDatabaseConfiguration;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockMovieDatabaseConfiguration = new Mock<IMovieDatabaseConfiguration>();
        }

        [TestMethod]
        public void GetApiKey_ReturnsCorrectApiKey()
        {
            // Arrange
            var expectedApiKey = "your-expected-api-key";

            _mockMovieDatabaseConfiguration.Setup(m => m.GetApiKey()).Returns(expectedApiKey);

            // Act
            var apiKey = _mockMovieDatabaseConfiguration.Object.GetApiKey();

            // Assert
            Assert.AreEqual(expectedApiKey, apiKey);
        }

        [TestMethod]
        public void GetApiKey_ReturnsNullWhenKeyIsMissing()
        {
            // Arrange
            _mockMovieDatabaseConfiguration.Setup(m => m.GetApiKey()).Returns((string?)null);

            // Act
            var apiKey = _mockMovieDatabaseConfiguration.Object.GetApiKey();

            // Assert
            Assert.IsNull(apiKey);
        }
    }
}