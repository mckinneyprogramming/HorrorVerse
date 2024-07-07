using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class MovieSeriesTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var movieSeries = fixture.Create<MovieSeries>();

            // Act
            var newMovieSeries = new MovieSeries(movieSeries.Title, movieSeries.TotalTime, movieSeries.TotalMovies, movieSeries.Watched, movieSeries.Id);

            // Assert
            Assert.IsNotNull(newMovieSeries);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newMovieSeries).Count == 0);
        }
    }
}