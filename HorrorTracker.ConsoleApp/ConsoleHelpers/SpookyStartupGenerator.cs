using HorrorTracker.ConsoleApp.Consoles;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data.Enumerations;

namespace HorrorTracker.ConsoleApp.ConsoleHelpers
{
    /// <summary>
    /// The <see cref="SpookyStartupGenerator"/> class.
    /// </summary>
    /// <remarks>
    /// Initializes a new instance of the <see cref="SpookyStartupGenerator"/> class.
    /// </remarks>
    /// <param name="themersFactory">The themers factory.</param>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class SpookyStartupGenerator(ThemersFactory themersFactory, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        private readonly ThemersFactory _themersFactory = themersFactory;
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <summary>
        /// The spooky startup text for the console application.
        /// </summary>
        /// <returns>The task.</returns>
        public void Startup()
        {
            _themersFactory.SpookyTextStyler.AmbientBeep();
            _themersFactory.SpookyAnimations.ParticleRain();
            _themersFactory.SpookyAnimations.StaticNoise();

            HauntedSplashScreen();

            _themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.Red, 100, "The spirits follow...");
            _themersFactory.SpookyAnimations.FlickeringCandle(3000, 100);
            _themersFactory.SpookyTextStyler.SpectralMist();

            _themersFactory.SpookyTextStyler.PrintCentered("ENTERING THE HORRORVERSE...");
            _themersFactory.SpookyTextStyler.BoxedText("WELCOME TO YOUR NIGHTMARE");
            _themersFactory.SpookyTextStyler.ColorCycleText("Beware...", [ConsoleColor.DarkGray, ConsoleColor.Gray, ConsoleColor.White, ConsoleColor.Gray]);
        }

        /// <summary>
        /// Displays a sppoky screen of shakes and glitching text.
        /// </summary>
        /// <returns>The task.</returns>
        private void HauntedSplashScreen()
        {
            _horrorConsole.Clear();

            _horrorConsole.MarkupLine("[red bold slowblink]>>> HORRORVERSE <<<[/]");
            _systemFunctions.Sleep(600);

            _themersFactory.SpookyAnimations.GlitchText(">>> WARNING: ENTITY DETECTED <<<", ConsoleColor.Magenta, 6, 80, GlitchPattern.Noise);
            _themersFactory.SpookyAnimations.ScreenShake(">>> ENGAGING LOCKDOWN <<<", shakes: 7, intensity: 3, delayMs: 60);
            _systemFunctions.Sleep(400);

            _themersFactory.SpookyAnimations.LoopPulse(":: INITIALIZING CURSED CORE ::", ConsoleColor.Red, intervalMs: 1500, repetitions: 1);
            _systemFunctions.Sleep(500);

            _themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.Yellow, 45, "Do not proceed if you value your soul...");
            _themersFactory.SpookyTextStyler.CrawlCursor("~", steps: 40, delayMs: 80);
            _themersFactory.SpookyAnimations.LoopPulse("ENTERING NIGHTMARE MODE...", ConsoleColor.DarkRed, intervalMs: 1000, repetitions: 3);

            _horrorConsole.WriteLine();
            _horrorConsole.MarkupLine("[red]Press any key to continue...[/]");
            _horrorConsole.ReadKey(true);
        }
    }
}