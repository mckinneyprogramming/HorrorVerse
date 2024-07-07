using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class BookSeriesTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var bookSeries = fixture.Create<BookSeries>();

            // Act
            var newBookSeries = new BookSeries(bookSeries.Title, bookSeries.Pages, bookSeries.TotalBooks, bookSeries.Read, bookSeries.Id);

            // Assert
            Assert.IsNotNull(newBookSeries);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newBookSeries).Count == 0);
        }
    }
}