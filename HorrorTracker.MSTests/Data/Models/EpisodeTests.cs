using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class EpisodeTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var episode = fixture.Create<Episode>();

            // Act
            var newEpisode = new Episode(
                episode.Title,
                episode.ShowId,
                episode.ReleaseDate,
                episode.Season,
                episode.EpisodeNumber,
                episode.Watched,
                episode.TotalTime,
                episode.Id);

            // Assert
            Assert.IsNotNull(newEpisode);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newEpisode).Count == 0);
        }
    }
}