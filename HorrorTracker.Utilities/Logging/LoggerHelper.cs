using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Utilities.Logging
{
    /// <summary>
    /// The <see cref="LoggerHelper"/> class.
    /// </summary>
    public class LoggerHelper
    {
        /// <summary>
        /// The logger service.
        /// </summary>
        private readonly ILoggerService _loggerService;

        /// <summary>
        /// Initializes a new instance of the <see cref="LoggerHelper"/> class.
        /// </summary>
        /// <param name="loggerService"></param>
        public LoggerHelper(ILoggerService loggerService)
        {
            _loggerService = loggerService;
        }

        /// <summary>
        /// Logs that the database connection is opened.
        /// </summary>
        public void DatabaseOpened()
        {
            _loggerService.LogInformation("HorrorTracker database is open.");
        }

        /// <summary>
        /// Logs that the database connection is closed.
        /// </summary>
        public void DatabaseClosed()
        {
            _loggerService.LogInformation("HorrorTracker database is closed.");
        }
    }
}