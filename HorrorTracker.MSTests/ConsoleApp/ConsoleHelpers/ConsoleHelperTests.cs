using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Tests
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class ConsoleHelperTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<ILoggerService> _mockLogger;
        private StringWriter _consoleOutput;
        private StringReader _consoleInput;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [TestInitialize]
        public void Setup()
        {
            _mockLogger = new Mock<ILoggerService>();

            _consoleOutput = new StringWriter();
            Console.SetOut(_consoleOutput);

            _consoleInput = new StringReader("");
            Console.SetIn(_consoleInput);
        }

        [TestCleanup]
        public void Cleanup()
        {
            Console.SetOut(Console.Out);
            Console.SetIn(Console.In);
        }

        [TestMethod]
        public void NewLine_WritesNewLine()
        {
            // Arrange

            // Act
            ConsoleHelper.NewLine();

            // Assert
            var output = _consoleOutput.ToString();
            Assert.AreEqual(Environment.NewLine, output);
        }

        [TestMethod]
        public void GroupedConsole_WritesGroupedMessage()
        {
            // Arrange
            var consoleColor = ConsoleColor.Green;
            var message = "Test Message";

            // Act
            ConsoleHelper.GroupedConsole(consoleColor, message);

            // Assert
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, message + Environment.NewLine);
        }

        [TestMethod]
        public void TypeMessage_TypesMessageCorrectly()
        {
            // Arrange
            var message = "Hello, World!";

            // Act
            ConsoleHelper.TypeMessage(message);

            // Assert
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, message + Environment.NewLine);
        }

        [TestMethod]
        public void GetUserInput_ReturnsUserInput()
        {
            // Arrange
            var input = "UserInput";
            _consoleInput = new StringReader(input);
            Console.SetIn(_consoleInput);

            // Act
            var result = ConsoleHelper.GetUserInput();

            // Assert
            Assert.AreEqual(input, result);
        }

        [TestMethod]
        public void ParseNumberDecision_ReturnsParsedNumber()
        {
            // Arrange
            var decision = "5";

            // Act
            var result = ConsoleHelper.ParseNumberDecision(_mockLogger.Object, decision);

            // Assert
            Assert.AreEqual(5, result);
        }

        [TestMethod]
        public void ProcessDecision_ExecutesCorrectAction()
        {
            // Arrange
            var actualNumber = 1;
            var actionExecuted = false;
            var actions = new Dictionary<int, Action>
            {
                { 1, () => actionExecuted = true }
            };

            // Act
            ConsoleHelper.ProcessDecision(actualNumber, _mockLogger.Object, actions);

            // Assert
            Assert.IsTrue(actionExecuted);
        }

        [TestMethod]
        public void ProcessDecision_InvalidSelection_LogsWarning()
        {
            // Arrange
            var actualNumber = 99;
            var actions = new Dictionary<int, Action>();

            // Act
            ConsoleHelper.ProcessDecision(actualNumber, _mockLogger.Object, actions);

            // Assert
            _mockLogger.Verify(logger => logger.LogWarning("Invalid selection made."), Times.Once);
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, "Invalid selection. Please enter a valid number." + Environment.NewLine);
        }

        [TestMethod]
        public void PerformActionsBasedOnDecision_ExceptionThrown_LogsError()
        {
            // Arrange
            var actualNumber = 1;
            var actions = new Dictionary<int, Action>
            {
                { 1, () => throw new Exception("Test exception") }
            };

            // Act
            ConsoleHelper.ProcessDecision(actualNumber, _mockLogger.Object, actions);

            // Assert
            _mockLogger.Verify(logger => logger.LogError("Error processing decision.", It.IsAny<Exception>()), Times.Once);
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, "An error occurred while processing your selection. Please try again." + Environment.NewLine);
        }

        [TestMethod]
        public void DisplayMenu_WhenStringIsPassedIn_ShouldDisplayMenu()
        {
            // Arrange
            var menu = "1. Series\n" +
                "2. Movie\n" +
                "3. Exit";

            // Act
            ConsoleHelper.DisplayMenu(menu);

            // Assert
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, menu);
        }

        [TestMethod]
        public void TypeStringPromptUser_WhenStringIsPassedIn_ShouldBeInTheOutput()
        {
            // Arrange
            var typeString = "Select an option below.";

            // Act
            ConsoleHelper.TypeStringPromptUser(typeString);

            // Assert
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, typeString);
        }

        [DataTestMethod]
        [DataRow("string", true)]
        [DataRow("", false)]
        [DataRow(null, false)]
        [DataRow("   ", false)]
        public void UserInputIsValid_WhenStringIsPassedIn_ShouldReturnCorrectBoolean(string value, bool expectedReturn)
        {
            // Arrange

            // Act
            var actualReturn = ConsoleHelper.UserInputIsValid(value);

            // Assert
            Assert.AreEqual(expectedReturn, actualReturn);
        }

        [TestMethod]
        public void DatabaseSuccessfulMessage_WhenStringIsPassedIn_ShouldBeInTheOutput()
        {
            // Arrange
            var value = "Movie was added successfully.";

            // Act
            ConsoleHelper.DatabaseSuccessfulMessage(value);

            // Assert
            var output = _consoleOutput.ToString();
            StringAssert.Contains(output, value);
        }
    }
}