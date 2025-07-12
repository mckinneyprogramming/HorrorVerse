namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="ISpookyTextStyler"/> interface.
    /// </summary>
    public interface ISpookyTextStyler
    {
        /// <summary>
        /// Puts a simple box around the provided text.
        /// </summary>
        /// <param name="text">The text message.</param>
        void BoxedText(string text);

        /// <summary>
        /// Allows the user to select a option from a menu with the arrow keys.
        /// </summary>
        /// <param name="title">The title of the menu.</param>
        /// <param name="options">The option selections.</param>
        void InteractiveMenu(string title, string[] options);

        /// <summary>
        /// Randomly generates beeps from the console.
        /// </summary>
        /// <param name="count">The number of beeps.</param>
        /// <param name="minFreq">The minimum frequency.</param>
        /// <param name="maxFreq">The maximum frequency.</param>
        void AmbientBeep(int count = 5, int minFreq = 200, int maxFreq = 800);

        /// <summary>
        /// Types dots at the end of the the string before replacing with the finished text.
        /// </summary>
        /// <param name="initialText">The initial text.</param>
        /// <param name="numberOfDots">The number of dots.</param>
        /// <param name="doneText">The finished text string.</param>
        void ThinkingAnimation(string initialText, int numberOfDots, string doneText);

        /// <summary>
        /// Prints the text to the console with delays between characters.
        /// </summary>
        /// <param name="consoleColor">The console color.</param>
        /// <param name="delayMs">The delay in milliseconds.</param>
        /// <param name="messages">The list of messages.</param>
        /// <returns>The task.</returns>
        Task Typewriter(ConsoleColor consoleColor = ConsoleColor.White, int delayMs = 50, params string[] messages);

        /// <summary>
        /// Crawls the given character across the console window.
        /// </summary>
        /// <param name="symbol">The symbol.</param>
        /// <param name="steps">The steps.</param>
        /// <param name="delayMs">The delay in milliseconds.</param>
        /// <returns>The task.</returns>
        Task CrawlCursor(string symbol = "*", int steps = 30, int delayMs = 50);

        /// <summary>
        /// Puts an underline under the text.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="lineChar">The underline character.</param>
        void Underline(string text, char lineChar = '─');

        /// <summary>
        /// Puts an overline over the text.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="lineChar">The overline character.</param>
        void Overline(string text, char lineChar = '─');

        /// <summary>
        /// Prints the text to the center of the console window.
        /// </summary>
        /// <param name="text">The text message.</param>
        void PrintCentered(string text);

        /// <summary>
        /// Prints the message a character at a time with color changes with each added character that is written.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="headColor">The head color.</param>
        /// <param name="trailColor">The trail color.</param>
        /// <param name="delayMs">The delay in milliseconds.</param>
        /// <returns>The task.</returns>
        Task TextWithTrail(
            string text,
            ConsoleColor headColor = ConsoleColor.Red,
            ConsoleColor trailColor = ConsoleColor.DarkRed,
            int delayMs = 100);

        /// <summary>
        /// Prints a random mist of characters on the console window.
        /// </summary>
        /// <param name="density">The density.</param>
        void SpectralMist(int density = 50);

        /// <summary>
        /// Prints the text to the console with a given set of colors.
        /// </summary>
        /// <param name="text">The text message.</param>
        /// <param name="cycleColors">The list of colors.</param>
        /// <param name="delayMs">The delay by milliseconds.</param>
        void ColorCycleText(string text, ConsoleColor[] cycleColors, int delayMs = 100);
    }
}