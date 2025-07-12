using HorrorTracker.Data.Enumerations;

namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="ISpookyAnimations"/> interface.
    /// </summary>
    public interface ISpookyAnimations
    {
        /// <summary>
        /// Prints a trail of characters.
        /// </summary>
        /// <param name="drops">The number of chracters to print.</param>
        /// <param name="particle">The character to be printed.</param>
        /// <param name="color">The color of the message.</param>
        /// <param name="delayMs">The delay of milliseconds.</param>
        void SlimeTrail(int drops = 50, char particle = '~', ConsoleColor color = ConsoleColor.Green, int delayMs = 100);

        /// <summary>
        /// Sparatically prints the character on the console window.
        /// </summary>
        /// <param name="drops">The number of characters to print.</param>
        /// <param name="particle">The character to be printed.</param>
        /// <param name="color">The color of the characters.</param>
        void ParticleRain(int drops = 100, char particle = '*', ConsoleColor color = ConsoleColor.DarkGray);

        /// <summary>
        /// Creates a static and sparatic random characters.
        /// </summary>
        /// <param name="durationMs">The duration of the method.</param>
        /// <param name="density">The density.</param>
        void StaticNoise(int durationMs = 200, int density = 500);

        /// <summary>
        /// Glitches the text on the same line of the console window.
        /// </summary>
        /// <param name="lines">Number of lines.</param>
        /// <param name="delayMs">The delay of milliseconds.</param>
        /// <returns>The task.</returns>
        Task GlitchWipe(int lines = 8, int delayMs = 35);

        /// <summary>
        /// Effect that shows a candle on the console window as if it is flickering.
        /// </summary>
        /// <param name="durationMs">The amount of time on the window.</param>
        /// <param name="frameDelay">The frame delay.</param>
        void FlickeringCandle(int durationMs = 3000, int frameDelay = 100);

        /// <summary>
        /// Prints the message in a ghostly artform.
        /// </summary>
        /// <param name="asciiArt">The art message.</param>
        /// <param name="flickers">The nunmber of flickers.</param>
        /// <param name="delayMs">The delay in milliseconds.</param>
        void GhostlyAsciiArt(string asciiArt, int flickers = 5, int delayMs = 150);

        /// <summary>
        /// Creates a looping pulse effect for the string message provided.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="consoleColor">The console color.</param>
        /// <param name="intervalMs">The intervals in milliseconds between pulses.</param>
        /// <param name="repetitions">The number of loops.</param>
        /// <returns>The task.</returns>
        Task LoopPulse(string text, ConsoleColor consoleColor = ConsoleColor.Red, int intervalMs = 500, int repetitions = 3);

        /// <summary>
        /// Glitches the console text message on the window.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="consoleColor">The console color.</param>
        /// <param name="glitches">The number of glitches.</param>
        /// <param name="delayMs">The delay in milliseconds.</param>
        /// <param name="pattern">The pattern of the glitch.</param>
        /// <returns>The task.</returns>
        Task GlitchText(
            string text,
            ConsoleColor consoleColor = ConsoleColor.Magenta,
            int glitches = 6,
            int delayMs = 90,
            GlitchPattern pattern = GlitchPattern.Default);

        /// <summary>
        /// Gives a screen shaking effect with the provided message.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="shakes">The number of shakes.</param>
        /// <param name="intensity">The intensity.</param>
        /// <param name="delayMs">The delay in milliseconds.</param>
        /// <returns>The task.</returns>
        Task ScreenShake(string text, int shakes = 6, int intensity = 2, int delayMs = 60);
    }
}