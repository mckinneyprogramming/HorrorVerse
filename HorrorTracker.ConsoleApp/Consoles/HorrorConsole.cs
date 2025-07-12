using HorrorTracker.ConsoleApp.Interfaces;
using Spectre.Console;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.ConsoleApp.Consoles
{
    /// <summary>
    /// The <see cref="HorrorConsole"/> class.
    /// </summary>
    /// <seealso cref="IHorrorConsole"/>
    [ExcludeFromCodeCoverage]
    public class HorrorConsole : IHorrorConsole
    {
        /// <inheritdoc/>
        public void SetForegroundColor(ConsoleColor color) => Console.ForegroundColor = color;

        /// <inheritdoc/>
        public void ResetColor() => Console.ResetColor();

        /// <inheritdoc/>
        public void Sleep(int ms) => Thread.Sleep(ms);

        /// <inheritdoc/>
        public string? ReadLine() => Console.ReadLine();

        /// <inheritdoc/>
        public ConsoleKeyInfo ReadKey(bool intercept) => Console.ReadKey(intercept);

        /// <inheritdoc/>
        public void Write(char character) => Console.Write(character);

        /// <inheritdoc/>
        public void Markup(string text) => AnsiConsole.Markup(text);

        /// <inheritdoc/>
        public void MarkupLine(string text) => AnsiConsole.MarkupLine(text);

        /// <inheritdoc/>
        public void Write(string text) => AnsiConsole.Write(text);

        /// <inheritdoc/>
        public void WriteLine() => AnsiConsole.WriteLine();

        /// <inheritdoc/>
        public void Clear() => AnsiConsole.Clear();

        /// <inheritdoc/>
        public void HideCursor() => AnsiConsole.Cursor.Hide();

        /// <inheritdoc/>
        public void ShowCursor() => AnsiConsole.Cursor.Show();

        /// <inheritdoc/>
        public void SetCursorPosition(int column, int line) => AnsiConsole.Cursor.SetPosition(column, line);

        /// <inheritdoc/>
        public string Prompt(SelectionPrompt<string> prompt) => AnsiConsole.Prompt(prompt);

        /// <inheritdoc/>
        public int ConsoleWidth() => Console.WindowWidth;

        /// <inheritdoc/>
        public int ConsoleHeight() => Console.WindowHeight;
    }
}