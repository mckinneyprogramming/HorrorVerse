using HorrorTracker.ConsoleApp.Managers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="ManualManager"/> class.
    /// </summary>
    /// <seealso cref="IManager"/>
    public class ManualManager : IManager
    {
        /// <summary>
        /// The logger service.
        /// </summary>
        private ILoggerService _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="ManualManager"/> class.
        /// </summary>
        /// <param name="logger">The logger.</param>
        public ManualManager(ILoggerService logger)
        {
            _logger = logger;
        }

        /// <inheritdoc/>
        public void Manage()
        {

        }
    }
}