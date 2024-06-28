using HorrorTracker.Utilities.Logging.Interfaces;
using Moq;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Shared
{
    /// <summary>
    /// The <see cref="LoggerVerifier"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class LoggerVerifier
    {
        /// <summary>
        /// The mock logger service.
        /// </summary>
        private readonly Mock<ILoggerService> _mockLoggerService;

        /// <summary>
        /// Initializes a new instance of the <see cref="LoggerVerifier"/> class.
        /// </summary>
        /// <param name="mockLoggerService">The mock logger service.</param>
        public LoggerVerifier(Mock<ILoggerService> mockLoggerService)
        {
            _mockLoggerService = mockLoggerService;
        }

        /// <summary>
        /// Verifies the logger information message.
        /// </summary>
        public void VerifyInformationMessage(string message)
        {
            _mockLoggerService.Verify(x => x.LogInformation(message), Times.Once);
        }

        /// <summary>
        /// Verifies the logger warning message.
        /// </summary>
        /// <param name="message"></param>
        public void VerifyWarningMessage(string message)
        {
            _mockLoggerService.Verify(x => x.LogWarning(message), Times.Once);
        }

        /// <summary>
        /// Verifies the logger error message.
        /// </summary>
        /// <param name="initialMessage">The initial message.</param>
        /// <param name="exceptionMessage">The exception message.</param>
        public void VerifyErrorMessage(string initialMessage, string exceptionMessage)
        {
            _mockLoggerService.Verify(x => x.LogError(initialMessage, It.Is<Exception>(ex => ex.Message == exceptionMessage)), Times.Once);
        }
    }
}