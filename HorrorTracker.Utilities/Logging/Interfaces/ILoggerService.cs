namespace HorrorTracker.Utilities.Logging.Interfaces
{
    /// <summary>
    /// The <see cref="ILoggerService"/> interface.
    /// </summary>
    public interface ILoggerService
    {
        /// <summary>
        /// Logs the information.
        /// </summary>
        /// <param name="message">The message to log.</param>
        void LogInformation(string message);

        /// <summary>
        /// Logs the error.
        /// </summary>
        /// <param name="message">The messgae.</param>
        /// <param name="exception">The exception that is thrown.</param>
        void LogError(string message, Exception exception);

        /// <summary>
        /// Logs the warning.
        /// </summary>
        /// <param name="message">The message.</param>
        void LogWarning(string message);

        /// <summary>
        /// Closes and flushes out the logger.
        /// </summary>
        void CloseAndFlush();
    }
}