using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class DocumentaryTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var documentary = fixture.Create<Documentary>();

            // Act
            var newDocumentary = new Documentary(documentary.Title, documentary.TotalTime, documentary.ReleaseYear, documentary.Watched, documentary.Id);

            // Assert
            Assert.IsNotNull(newDocumentary);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newDocumentary).Count == 0);
        }
    }
}