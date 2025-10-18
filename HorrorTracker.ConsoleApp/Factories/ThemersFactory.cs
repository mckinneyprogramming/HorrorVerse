using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.ConsoleApp.Themers;

namespace HorrorTracker.ConsoleApp.Factories
{
    /// <summary>
    /// The <see cref="ThemersFactory"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="ThemersFactory"/> class.
    /// </remarks>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class ThemersFactory(IHorrorConsole horrorConsole, ISystemFunctions systemFunctions) : IThemersFactory
    {
        /// <inheritdoc/>
        public ISpookyAnimations SpookyAnimations { get; } = new SpookyAnimations(horrorConsole, systemFunctions);

        /// <inheritdoc/>
        public ISpookyTextStyler SpookyTextStyler { get; } = new SpookyTextStyler(horrorConsole, systemFunctions);
    }
}