using Spectre.Console;

namespace HorrorTracker.ConsoleApp.Interfaces
{
    /// <summary>
    /// The <see cref="IHorrorConsole"/> interface.
    /// </summary>
    public interface IHorrorConsole
    {
        /// <summary>
        /// Sets the foreground color of the text.
        /// </summary>
        /// <param name="color">The console color.</param>
        void SetForegroundColor(ConsoleColor color);

        /// <summary>
        /// Resets the background and foreground color of the text.
        /// </summary>
        void ResetColor();

        /// <summary>
        /// Suspends the thread of the task.
        /// </summary>
        /// <param name="milliseconds">The milliseconds of delay.</param>
        void Sleep(int milliseconds);

        /// <summary>
        /// Reads what is typed to the console.
        /// </summary>
        /// <returns>The text.</returns>
        string? ReadLine();

        /// <summary>
        /// Reads any key from the users keyboard.
        /// </summary>
        /// <param name="intercept">True if the key info recieves a key stroke; false otherwise.</param>
        /// <returns>The console key info.</returns>
        ConsoleKeyInfo ReadKey(bool intercept);

        /// <summary>
        /// Writes a character to the console.
        /// </summary>
        /// <param name="character">The character.</param>
        void Write(char character);

        /// <summary>
        /// Writes the specified markup to the console.
        /// </summary>
        /// <param name="text">The text to write.</param>
        void Markup(string text);

        /// <summary>
        /// Writes the specified markup line to the console.
        /// </summary>
        /// <param name="text">The text to write.</param>
        void MarkupLine(string text);

        /// <summary>
        /// Writes a message to the console.
        /// </summary>
        /// <param name="text">The text message.</param>
        void Write(string text);

        /// <summary>
        /// Writes an empty line to the console.
        /// </summary>
        void WriteLine();

        /// <summary>
        /// Clears the console window.
        /// </summary>
        void Clear();

        /// <summary>
        /// Hides the cursor during the writing to the console.
        /// </summary>
        void HideCursor();

        /// <summary>
        /// Shows the cursor during the writing to the console.
        /// </summary>
        void ShowCursor();

        /// <summary>
        /// Sets the cursor position on the console window.
        /// </summary>
        /// <param name="column">The column position.</param>
        /// <param name="line">The line position.</param>
        void SetCursorPosition(int column, int line);

        /// <summary>
        /// Retrieves the prompt menu for the console window.
        /// </summary>
        /// <param name="prompt">The prompt.</param>
        /// <returns>The decision.</returns>
        string Prompt(SelectionPrompt<string> prompt);

        /// <summary>
        /// Retrieves the Console width.
        /// </summary>
        /// <returns>The console width.</returns>
        int ConsoleWidth();

        /// <summary>
        /// Retrieves the Console height.
        /// </summary>
        /// <returns>The console height.</returns>
        int ConsoleHeight();
    }
}