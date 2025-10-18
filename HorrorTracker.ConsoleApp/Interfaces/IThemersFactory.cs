namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="IThemersFactory"/> interface.
    /// </summary>
    public interface IThemersFactory
    {
        /// <summary>
        /// Gets the SpookyAnimations.
        /// </summary>
        ISpookyAnimations SpookyAnimations { get; }

        /// <summary>
        /// Gets the SpookyTextStyler.
        /// </summary>
        ISpookyTextStyler SpookyTextStyler { get; }
    }
}