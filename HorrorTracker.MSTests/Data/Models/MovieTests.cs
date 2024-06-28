using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class MovieTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var movie = fixture.Create<Movie>();

            // Act
            var newMovie = new Movie(movie.Title, movie.TotalTime, movie.PartOfSeries, movie.SeriesId, movie.ReleaseYear, movie.Watched, movie.Id)
            {
                Title = movie.Title
            };

            // Assert
            Assert.IsNotNull(newMovie);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newMovie).Count == 0);
        }
    }
}