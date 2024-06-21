using AutoFixture;
using HorrorTracker.Data.Models;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class ShowTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var show = fixture.Create<Show>();

            // Act
            var newShow = new Show(show.Title, show.TotalTime, show.TotalEpisodes, show.NumberOfSeasons, show.Watched, show.Id)
            {
                Title = show.Title
            };

            // Assert
            Assert.IsNotNull(newShow);
            Assert.IsNotNull(newShow.Title);
            Assert.IsNotNull(newShow.TotalTime);
            Assert.IsNotNull(newShow.TotalEpisodes);
            Assert.IsNotNull(newShow.NumberOfSeasons);
            Assert.IsNotNull(newShow.Watched);
            Assert.IsNotNull(newShow.Id);
        }
    }
}