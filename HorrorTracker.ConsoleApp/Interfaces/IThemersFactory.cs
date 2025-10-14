namespace HorrorTracker.ConsoleApp.Interfaces
{
    public interface IThemersFactory
    {
        ISpookyAnimations SpookyAnimations { get; }

        ISpookyTextStyler SpookyTextStyler { get; }
    }
}