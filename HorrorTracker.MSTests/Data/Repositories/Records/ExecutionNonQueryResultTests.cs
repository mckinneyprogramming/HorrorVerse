using HorrorTracker.Data.Repositories.Records;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Repositories.Records
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class ExecutionNonQueryResultTests
    {
        [TestMethod]
        public void ExecutionNonQueryResult_Constructor_SetsProperties()
        {
            // Arrange
            var expectedRowsAffected = 5;
            var expectedSuccess = true;
            var expectedMessage = "Operation completed successfully.";

            // Act
            var result = new ExecutionNonQueryResult(expectedRowsAffected, expectedSuccess, expectedMessage);

            // Assert
            Assert.AreEqual(expectedRowsAffected, result.RowsAffected);
            Assert.AreEqual(expectedSuccess, result.Success);
            Assert.AreEqual(expectedMessage, result.Message);
        }

        [TestMethod]
        public void WhenHavingValidRecord_ShouldCreateNewInstanceWithUpdatedProperties()
        {
            // Arrange
            var original = new ExecutionNonQueryResult(1, true, "Initial");

            // Act
            var updated = original with { RowsAffected = 10, Success = false, Message = "Updated" };

            // Assert
            Assert.IsFalse(updated.Success);
            Assert.AreEqual(10, updated.RowsAffected);
            Assert.AreEqual("Updated", updated.Message);
            Assert.AreNotSame(original, updated);
        }
    }
}