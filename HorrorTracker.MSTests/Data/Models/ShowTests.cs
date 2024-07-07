using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
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
            var newShow = new Show(show.Title, show.TotalTime, show.TotalEpisodes, show.NumberOfSeasons, show.Watched, show.Id);

            // Assert
            Assert.IsNotNull(newShow);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newShow).Count == 0);
        }
    }
}