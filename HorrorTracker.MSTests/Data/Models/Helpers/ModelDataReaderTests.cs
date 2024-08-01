using HorrorTracker.Data.Models.Helpers;
using Moq;
using System.Data;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models.Helpers
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class ModelDataReaderTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<IDataReader> _mockDataReader;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockDataReader = new Mock<IDataReader>();
        }

        [TestMethod]
        public void MovieSeriesFunction_ShouldMapDataReaderToMovieSeries()
        {
            // Arrange
            _mockDataReader.Setup(r => r.GetInt32(0)).Returns(1);
            _mockDataReader.Setup(r => r.GetString(1)).Returns("Series Title");
            _mockDataReader.Setup(r => r.GetDecimal(2)).Returns(120.5m);
            _mockDataReader.Setup(r => r.GetInt32(3)).Returns(5);
            _mockDataReader.Setup(r => r.GetBoolean(4)).Returns(true);

            var func = ModelDataReader.MovieSeriesFunction();

            // Act
            var result = func(_mockDataReader.Object);

            // Assert
            Assert.AreEqual(1, result.Id);
            Assert.AreEqual("Series Title", result.Title);
            Assert.AreEqual(120.5m, result.TotalTime);
            Assert.AreEqual(5, result.TotalMovies);
            Assert.AreEqual(true, result.Watched);
        }

        [TestMethod]
        public void MovieFunction_ShouldMapDataReaderToMovie()
        {
            // Arrange
            _mockDataReader.Setup(r => r.GetInt32(0)).Returns(2);
            _mockDataReader.Setup(r => r.GetString(1)).Returns("Movie Title");
            _mockDataReader.Setup(r => r.GetDecimal(2)).Returns(95.3m);
            _mockDataReader.Setup(r => r.GetBoolean(3)).Returns(true);
            _mockDataReader.Setup(r => r.GetInt32(4)).Returns(2001);
            _mockDataReader.Setup(r => r.GetInt32(5)).Returns(3);
            _mockDataReader.Setup(r => r.GetBoolean(6)).Returns(false);

            var func = ModelDataReader.MovieFunction();

            // Act
            var result = func(_mockDataReader.Object);

            // Assert
            Assert.AreEqual(2, result.Id);
            Assert.AreEqual("Movie Title", result.Title);
            Assert.AreEqual(95.3m, result.TotalTime);
            Assert.AreEqual(true, result.PartOfSeries);
            Assert.AreEqual(2001, result.SeriesId);
            Assert.AreEqual(3, result.ReleaseYear);
            Assert.AreEqual(false, result.Watched);
        }

        [TestMethod]
        public void DocumentaryFunction_ShouldMapDataReaderToDocumentary()
        {
            // Arrange
            _mockDataReader.Setup(r => r.GetInt32(0)).Returns(3);
            _mockDataReader.Setup(r => r.GetString(1)).Returns("Documentary Title");
            _mockDataReader.Setup(r => r.GetDecimal(2)).Returns(80.5m);
            _mockDataReader.Setup(r => r.GetInt32(3)).Returns(2019);
            _mockDataReader.Setup(r => r.GetBoolean(4)).Returns(true);

            var func = ModelDataReader.DocumentaryFunction();

            // Act
            var result = func(_mockDataReader.Object);

            // Assert
            Assert.AreEqual(3, result.Id);
            Assert.AreEqual("Documentary Title", result.Title);
            Assert.AreEqual(80.5m, result.TotalTime);
            Assert.AreEqual(2019, result.ReleaseYear);
            Assert.AreEqual(true, result.Watched);
        }
    }
}