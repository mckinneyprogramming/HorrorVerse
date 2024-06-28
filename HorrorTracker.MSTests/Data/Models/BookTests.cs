using AutoFixture;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Models
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class BookTests
    {
        [TestMethod]
        public void Constructor_WhenCalled_ShouldSetPropertyValues()
        {
            // Arrange
            var fixture = new Fixture();
            var book = fixture.Create<Book>();

            // Act
            var newBook = new Book(book.Title, book.SeriesId, book.Pages, book.PartOfSeries, book.ReleaseYear, book.Read, book.Id)
            {
                Title = book.Title
            };

            // Assert
            Assert.IsNotNull(newBook);
            Assert.IsTrue(PropertyCollector.RetrieveNullProperties(newBook).Count == 0);
        }
    }
}