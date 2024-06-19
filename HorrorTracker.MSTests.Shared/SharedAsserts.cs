using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Shared
{
    /// <summary>
    /// The <see cref="SharedAsserts"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class SharedAsserts
    {
        /// <summary>
        /// The mock logger service.
        /// </summary>
        private Mock<ILoggerService> _mockLoggerService;

        /// <summary>
        /// Initializes a new instance of the <see cref="SharedAsserts"/> class.
        /// </summary>
        /// <param name="mockLoggerService">The mock logger service.</param>
        public SharedAsserts(Mock<ILoggerService> mockLoggerService)
        {
            _mockLoggerService = mockLoggerService;
        }

        /// <summary>
        /// The shared Asserts for the class.
        /// </summary>
        public void VerifyLoggerInformationMessage(string message)
        {
            _mockLoggerService.Verify(x => x.LogInformation(message), Times.Once);
        }
    }
}