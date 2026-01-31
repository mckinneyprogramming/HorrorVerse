using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.ConsoleApp.Themers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.ConsoleApp.Factories
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class ThemersFactoryTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
        private Mock<IHorrorConsole> _mockConsole;
        private Mock<ISystemFunctions> _mockSystemFunctions;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.

        [TestInitialize]
        public void Initialize()
        {
            _mockConsole = new Mock<IHorrorConsole>();
            _mockSystemFunctions = new Mock<ISystemFunctions>();
        }

        [TestMethod]
        public void Constructor_WhenFactoryIsInitialized_ShouldInitializeProperties()
        {
            // Arrange & Act
            var factory = new ThemersFactory(_mockConsole.Object, _mockSystemFunctions.Object);

            // Assert
            Assert.IsNotNull(factory.SpookyAnimations, "SpookyAnimations should not be null after construction.");
            Assert.IsInstanceOfType<SpookyAnimations>(factory.SpookyAnimations, "SpookyAnimations should be an instance of SpookyAnimations.");
            Assert.IsInstanceOfType<ISpookyAnimations>(factory.SpookyAnimations, "SpookyAnimations should implement ISpookyAnimations.");

            Assert.IsNotNull(factory.SpookyTextStyler, "SpookyTextStyler should not be null after construction.");
            Assert.IsInstanceOfType<SpookyTextStyler>(factory.SpookyTextStyler, "SpookyTextStyler should be an instance of SpookyTextStyler.");
            Assert.IsInstanceOfType<ISpookyTextStyler>(factory.SpookyTextStyler, "SpookyTextStyler should implement ISpookyTextStyler.");
        }

        [TestMethod]
        public void ThemersFactory_WhenInitialized_ShouldImplementIThemersFactoryInterface()
        {
            // Arrange
            var factory = new ThemersFactory(_mockConsole.Object, _mockSystemFunctions.Object);

            // Act

            // Assert
            Assert.IsInstanceOfType<IThemersFactory>(factory, "ThemersFactory should implement IThemersFactory.");
        }
    }
}