using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data.Enumerations;

namespace HorrorTracker.ConsoleApp.Themers
{
    /// <summary>
    /// The <see cref="SpookyAnimations"/> class.
    /// </summary>
    /// <seealso cref="ISpookyAnimations"/> interface.
    /// <remarks>
    /// Initializes a new instance of the <see cref="SpookyAnimations"/> class.
    /// </remarks>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class SpookyAnimations(IHorrorConsole horrorConsole, ISystemFunctions systemFunctions) : ISpookyAnimations
    {
        private readonly IHorrorConsole _horrorConsole = horrorConsole;
        private readonly ISystemFunctions _systemFunctions = systemFunctions;

        private static readonly string[] SpectreColors =
        [
            "red", "green", "blue", "yellow", "magenta", "cyan",
            "grey", "white", "orange1", "deeppink4"
        ];

        /// <inheritdoc/>
        public void SlimeTrail(int drops = 50, char particle = '~', ConsoleColor color = ConsoleColor.Green, int delay = 100)
        {
            if (!ValidateDrops(drops))
            {
                return;
            }

            GenerateParticles(drops, particle, color, delay,
                () => _systemFunctions.Next(_horrorConsole.ConsoleWidth()),
                () => _systemFunctions.Next(_horrorConsole.ConsoleHeight()));
            _horrorConsole.Clear();
        }

        /// <inheritdoc/>
        public void ParticleRain(int drops = 100, char particle = '*', ConsoleColor color = ConsoleColor.DarkGray)
        {
            if (!ValidateDrops(drops))
            {
                return;
            }

            GenerateParticles(drops, particle, color, 20, () => _systemFunctions.Next(_horrorConsole.ConsoleWidth()), () => 0);
            _horrorConsole.ShowCursor();
        }

        /// <inheritdoc/>
        public void StaticNoise(int durationMs = 200, int density = 500)
        {
            durationMs = durationMs >= 3000 ? 200 : durationMs;

            var frameDelay = 50;
            var frameCount = durationMs / frameDelay;

            for (var i = 0; i < frameCount; i++)
            {
                for (var j = 0; j < density; j++)
                {
                    _horrorConsole.SetCursorPosition(
                        _systemFunctions.Next(_horrorConsole.ConsoleWidth()),
                        _systemFunctions.Next(_horrorConsole.ConsoleHeight()));
                    _horrorConsole.Write(_systemFunctions.NextChar(33, 126));
                }

                _horrorConsole.Sleep(frameDelay);
            }

            _horrorConsole.Clear();
        }

        /// <inheritdoc/>
        public void GlitchWipe(int lines = 8, int delayMs = 35)
        {
            for (int i = 0; i < lines; i++)
            {
                var randomChar = _systemFunctions.NextChar(33, 126);
                var glitchLine = new string(randomChar, _horrorConsole.ConsoleWidth() - 1);
                var color = GetRandomSpectreColor();

                _horrorConsole.MarkupLine($"[{color}]{glitchLine}[/]");
                _systemFunctions.Sleep(delayMs);
            }

            _horrorConsole.Clear();
        }

        /// <inheritdoc/>
        public void FlickeringCandle(int durationMs = 3000, int frameDelay = 100)
        {
            var frameCount = durationMs / frameDelay;
            var candle = new[]
            {
                "  (  )  ",
                "   ) (   ",
                "    )    ",
                "   | |   ",
                "   | |   ",
                "   |_|   "
            };

            for (int i = 0; i < frameCount; i++)
            {
                _horrorConsole.Clear();
                var color = _systemFunctions.Next(0, 2) == 0 ? ConsoleColor.DarkYellow : ConsoleColor.Yellow;
                _horrorConsole.SetForegroundColor(color);

                var offset = _systemFunctions.Next(-2, 3);
                foreach (var line in candle)
                {
                    _horrorConsole.Write(new string(' ', Math.Max(0, offset)));
                    _horrorConsole.MarkupLine(line);
                }

                _horrorConsole.Sleep(frameDelay);
            }

            _horrorConsole.ResetColor();
            _horrorConsole.Clear();
        }

        /// <inheritdoc/>
        public void GhostlyAsciiArt(string asciiArt, int flickers = 5, int delayMs = 150)
        {
            for (var f = 0; f < flickers; f++)
            {
                _horrorConsole.Clear();
                _horrorConsole.MarkupLine($"[grey]{asciiArt}[/]");

                _horrorConsole.Sleep(delayMs);
                _horrorConsole.Clear();
                _horrorConsole.Sleep(delayMs / 2);
            }
        }

        /// <inheritdoc/>
        public void LoopPulse(string text, ConsoleColor consoleColor = ConsoleColor.Red, int intervalMs = 500, int repetitions = 3)
        {
            var spectreColor = ThemersUtility.GetSpectreColor(consoleColor);
            for (int i = 0; i < repetitions; i++)
            {
                _horrorConsole.MarkupLine($"[{spectreColor}]{text}[/]");
                _systemFunctions.Sleep(intervalMs);

                _horrorConsole.Clear();
                _systemFunctions.Sleep(intervalMs / 2);
            }

            _horrorConsole.MarkupLine($"[{spectreColor}]{text}[/]");
        }

        /// <inheritdoc/>
        public void GlitchText(
            string text,
            ConsoleColor consoleColor = ConsoleColor.Magenta,
            int glitches = 6,
            int delayMs = 90,
            GlitchPattern pattern = GlitchPattern.Default)
        {
            var spectreColor = ThemersUtility.GetSpectreColor(consoleColor);

            for (var i = 0; i < glitches; i++)
            {
                if (_systemFunctions.NextDouble() < 0.1)
                {
                    _horrorConsole.Clear();
                    _systemFunctions.Sleep(30);
                }

                string glitchedString = ApplyGlitchPattern(text, pattern);

                _horrorConsole.MarkupLine($"[{spectreColor}]{glitchedString}[/]");
                _systemFunctions.Sleep(delayMs);
                _horrorConsole.Clear();
            }

            _horrorConsole.MarkupLine($"[{spectreColor}]{text}[/]");
        }

        /// <inheritdoc/>
        public void ScreenShake(string text, int shakes = 6, int intensity = 2, int delayMs = 60)
        {
            for (var i = 0; i < shakes; i++)
            {
                var offsetX = _systemFunctions.Next(-intensity, intensity + 1);
                var offsetY = _systemFunctions.Next(-intensity, intensity + 1);

                _horrorConsole.Clear();
                _horrorConsole.Write(new string('\n', Math.Max(0, offsetY)));
                _horrorConsole.MarkupLine($"{new string(' ', Math.Max(0, offsetX))}[red]{text}[/]");
                _systemFunctions.Sleep(delayMs);
            }

            _horrorConsole.Clear();
            _horrorConsole.MarkupLine($"[bold red]{text}[/]");
        }

        /// <summary>
        /// Validates that the number of drops is greater than 0.
        /// </summary>
        /// <param name="drops">The number of drops.</param>
        /// <returns>True or false.</returns>
        private bool ValidateDrops(int drops)
        {
            if (drops <= 0)
            {
                _horrorConsole.SetForegroundColor(ConsoleColor.Red);
                _horrorConsole.MarkupLine("You must have at least one drop.");
                _horrorConsole.ResetColor();
                _systemFunctions.Sleep(2000);
                _horrorConsole.Clear();
                return false;
            }

            return true;
        }

        /// <summary>
        /// Generates particles for the animation on the console window.
        /// </summary>
        /// <param name="drops">The number of drops.</param>
        /// <param name="particle">The particle character.</param>
        /// <param name="color">The console color.</param>
        /// <param name="delay">The delay.</param>
        /// <param name="getWidth">The console width function.</param>
        /// <param name="getHeight">The console height function.</param>
        private void GenerateParticles(int drops, char particle, ConsoleColor color, int delay, Func<int> getWidth, Func<int> getHeight)
        {
            var markupColor = ThemersUtility.GetSpectreColor(color);
            var safeDelay = Math.Max(0, delay);
            foreach (var _ in Enumerable.Range(0, Math.Min(drops, 1000)))
            {
                _horrorConsole.SetCursorPosition(getWidth(), getHeight());
                _horrorConsole.Markup($"[{markupColor}]{particle}[/]");
                _horrorConsole.Sleep(safeDelay);
            }
        }

        /// <summary>
        /// Applies the glitch pattern and returns the pattern.
        /// </summary>
        /// <param name="text">The initial text.</param>
        /// <param name="pattern">The glitch pattern type.</param>
        /// <returns>The string pattern.</returns>
        private string ApplyGlitchPattern(string text, GlitchPattern pattern)
        {
            return pattern switch
            {
                GlitchPattern.Flicker => new string(text.Select(c => _systemFunctions.Next(0, 4) == 0 ? _systemFunctions.NextChar(33, 126) : c).ToArray()),
                GlitchPattern.Scramble => new string([.. text.OrderBy(_ => _systemFunctions.Next())]),
                GlitchPattern.Noise => new string(text.Select(c => _systemFunctions.Next(0, 3) == 0 ? '#' : c).ToArray()),
                GlitchPattern.Reversed => new string(text.Reverse().ToArray()),
                _ => new string(text.Select(c => _systemFunctions.Next(0, 5) == 0 ? _systemFunctions.NextChar(33, 126) : c).ToArray()),
            };
        }

        /// <summary>
        /// Retrieves the random spectre color.
        /// </summary>
        /// <returns>The spectre color string.</returns>
        private string GetRandomSpectreColor() => SpectreColors[_systemFunctions.Next(SpectreColors.Length)];
    }
}