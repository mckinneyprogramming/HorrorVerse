using HorrorTracker.ConsoleApp.Interfaces;
using Spectre.Console;
using static System.Net.Mime.MediaTypeNames;

namespace HorrorTracker.ConsoleApp.Themers
{
    /// <summary>
    /// The <see cref="SpookyTextStyler"/> class.
    /// </summary>
    /// <seealso cref="ISpookyTextStyler"/> interface.
    /// <remarks>
    /// Initializes a new instance of the <see cref="SpookyTextStyler"/> class.
    /// </remarks>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class SpookyTextStyler(IHorrorConsole horrorConsole, ISystemFunctions systemFunctions) : ISpookyTextStyler
    {
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        /// <inheritdoc/>
        public void BoxedText(string text)
        {
            var lines = text.Split('\n');
            var width = lines.Max(l => l.Length) + 4;

            _horrorConsole.MarkupLine("╔" + new string('═', width - 2) + "╗");

            foreach (var line in lines)
            {
                _horrorConsole.MarkupLine("║ " + line.PadRight(width - 4) + " ║");
            }

            _horrorConsole.MarkupLine("╚" + new string('═', width - 2) + "╝");
        }

        /// <inheritdoc/>
        public string InteractiveMenu(string title, string[] options)
        {
            var prompt = new SelectionPrompt<string>()
                .Title($"[bold red]{title}[/]")
                .PageSize(10)
                .AddChoices(options)
                .HighlightStyle(new Style(foreground: Color.DarkViolet));

            return _horrorConsole.Prompt(prompt);
        }

        /// <inheritdoc/>
        public void AmbientBeep(int count = 5, int minFreq = 200, int maxFreq = 800)
        {
            for (var i = 0; i < count; i++)
            {
                if (OperatingSystem.IsWindows())
                {
                    Console.Beep(_systemFunctions.Next(minFreq, maxFreq), _systemFunctions.Next(100, 400));
                }

                _horrorConsole.Sleep(_systemFunctions.Next(200, 800));
            }
        }

        /// <inheritdoc/>
        public void ThinkingAnimation(string initialText, int numberOfDots, string doneText)
        {
            _horrorConsole.Write(initialText);

            for (int i = 0; i < numberOfDots; i++)
            {
                _horrorConsole.Write(".");
                _systemFunctions.Sleep(500);
            }

            Console.SetCursorPosition(0, Console.CursorTop);
            _horrorConsole.Write(new string(' ', Console.WindowWidth));
            Console.SetCursorPosition(0, Console.CursorTop);
            _horrorConsole.MarkupLine(doneText);
        }

        /// <inheritdoc/>
        public void Typewriter(ConsoleColor consoleColor = ConsoleColor.White, int delayMs = 50, params string[] messages)
        {
            var spectreColor = ToSpectreColor(consoleColor);
            foreach (var message in messages)
            {
                foreach (char character in message)
                {
                    _horrorConsole.Markup($"[{spectreColor}]{character}[/]");
                    _systemFunctions.Sleep(delayMs);
                }

                _horrorConsole.WriteLine();
            }
        }

        /// <inheritdoc/>
        public void CrawlCursor(string symbol = "*", int steps = 30, int delayMs = 50)
        {
            _horrorConsole.HideCursor();
            for (int i = 0; i < steps; i++)
            {
                _horrorConsole.Markup(symbol);
                _systemFunctions.Sleep(delayMs);
            }

            _horrorConsole.WriteLine();
            _horrorConsole.ShowCursor();
        }

        /// <inheritdoc/>
        public void Underline(string text, char lineChar = '─') => _horrorConsole.MarkupLine(text + "\n" + new string(lineChar, text.Length));

        /// <inheritdoc/>
        public void Overline(string text, char lineChar = '─') => _horrorConsole.MarkupLine(new string(lineChar, text.Length) + "\n" + text);

        /// <inheritdoc/>
        public void PrintCentered(string text)
        {
            _horrorConsole.SetCursorPosition(Math.Max(0, (Console.WindowWidth - text.Length) / 2), Console.CursorTop);
            _horrorConsole.MarkupLine(text);
        }

        /// <inheritdoc/>
        public void TextWithTrail(
            string text,
            ConsoleColor headColor = ConsoleColor.Red,
            ConsoleColor trailColor = ConsoleColor.DarkRed,
            int delayMs = 100)
        {
            var spectreHeadColor = ToSpectreColor(headColor);
            var spectreTrailColor = ToSpectreColor(trailColor);
            for (int i = 0; i < text.Length; i++)
            {
                var head = $"[{spectreHeadColor}]{text[i]}[/]";
                var trail = "";

                for (int t = 1; t <= 3; t++)
                {
                    int pos = i - t;
                    if (pos < 0) break;
                    trail = $"[{spectreTrailColor}]{text[pos]}[/]" + trail;
                }

                _horrorConsole.Clear();
                _horrorConsole.MarkupLine(trail + head);
                _systemFunctions.Sleep(delayMs);
            }

            _horrorConsole.WriteLine();
        }

        /// <inheritdoc/>
        public void SpectralMist(int density = 50)
        {
            var width = Console.WindowWidth;
            var height = Console.WindowHeight;

            for (var i = 0; i < density; i++)
            {
                var windowWidth = _systemFunctions.Next(width);
                var windowHeight = _systemFunctions.Next(height);
                _horrorConsole.SetCursorPosition(windowWidth, windowHeight);
                _horrorConsole.Markup("[grey].[/]");
            }

            _horrorConsole.HideCursor();
            _horrorConsole.Sleep(100);
            _horrorConsole.Clear();
            _horrorConsole.ShowCursor();
        }

        /// <inheritdoc/>
        public void ColorCycleText(string text, ConsoleColor[] cycleColors, int delayMs = 100)
        {
            foreach (var color in cycleColors)
            {
                _horrorConsole.Markup($"\r[{ToSpectreColor(color)}]{text}[/]");
                _horrorConsole.Sleep(delayMs);
            }

            _horrorConsole.WriteLine();
        }

        /// <summary>
        /// Retrieves the spectre color with the console color.
        /// </summary>
        /// <param name="color">The console color.</param>
        /// <returns>The spectre color string.</returns>
        private static string ToSpectreColor(ConsoleColor color) => ThemersUtility.GetSpectreColor(color);
    }
}