namespace HorrorTracker.ConsoleApp.Themers
{
    /// <summary>
    /// The <see cref="ThemersUtility"/> class.
    /// </summary>
    public static class ThemersUtility
    {
        /// <summary>
        /// Retrieves the Spectre color from the Console color.
        /// </summary>
        /// <param name="color">The console color.</param>
        /// <returns>The Spectre color string.</returns>
        public static string GetSpectreColor(ConsoleColor color)
        {
            return color switch
            {
                ConsoleColor.Black => "black",
                ConsoleColor.Blue => "blue",
                ConsoleColor.Cyan => "cyan",
                ConsoleColor.Gray => "gray",
                ConsoleColor.Green => "green",
                ConsoleColor.Magenta => "magenta",
                ConsoleColor.Red => "red",
                ConsoleColor.White => "white",
                ConsoleColor.Yellow => "yellow",
                _ => "grey",
            };
        }
    }
}