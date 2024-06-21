using HorrorTracker.Utilities.Parsing;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Utilities.Parsing
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class ParserTests
    {
        [TestMethod]
        public void IsInteger_WhenValueIsAnInteger_ShouldReturnTrue()
        {
            // Arrange
            var stringValue = "123";
            var expectedIntegerValue = 123;

            // Act
            var boolValue = Parser.IsInteger(stringValue, out var actualIntegerValue);

            // Assert
            Assert.IsTrue(boolValue);
            Assert.AreEqual(expectedIntegerValue, actualIntegerValue);
        }

        [DataTestMethod]
        [DataRow("")]
        [DataRow("string")]
        public void IsInteger_WhenValueIsNotInteger_ShouldReturnFalse(string stringValue)
        {
            // Arrange
            var expectedIntegerValue = 0;

            // Act
            var boolValue = Parser.IsInteger(stringValue, out var actualIntegerValue);

            // Assert
            Assert.IsFalse(boolValue);
            Assert.AreEqual(expectedIntegerValue, actualIntegerValue);
        }

        [TestMethod]
        public void IsDecimal_WhenValueIsDecimal_ShouldReturnTrue()
        {
            // Arrange
            var value = 12.34M;
            var expectedDecimalValue = 12.34M;

            // Act
            var boolValue = Parser.IsDecimal(value, out var actualDecimalValue);

            // Assert
            Assert.IsTrue(boolValue);
            Assert.AreEqual(expectedDecimalValue, actualDecimalValue);
        }

        [TestMethod]
        public void IsDecimal_WhenValueIsString_ShouldReturnTrue()
        {
            // Arrange
            var value = "12.34";
            var expectedDecimalValue = 12.34M;

            // Act
            var boolValue = Parser.IsDecimal(value, out var actualDecimalValue);

            // Assert
            Assert.IsTrue(boolValue);
            Assert.AreEqual(expectedDecimalValue, actualDecimalValue);
        }

        [TestMethod]
        public void IsDecimal_WhenValueIsNotDecimalOrString_ShouldReturnFalse()
        {
            // Arrange
            var expectedDecimalValue = 0.0M;

            // Act
            var boolValue = Parser.IsDecimal(new object(), out var actualDecimalValue);

            // Assert
            Assert.IsFalse(boolValue);
            Assert.AreEqual(expectedDecimalValue, actualDecimalValue);
        }
    }
}