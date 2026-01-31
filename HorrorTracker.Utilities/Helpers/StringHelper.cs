namespace HorrorTracker.Utilities.Helpers
{
    public static class StringHelper
    {
        /// <summary>
        /// Determines whether the specified input string represents an affirmative response.
        /// </summary>
        /// <param name="input">The input string to evaluate.</param>
        /// <returns><c>true</c> if the input string is affirmative; otherwise, <c>false</c>.</returns>
        public static bool IsAffirmative(string? input)
        {
            if (string.IsNullOrWhiteSpace(input))
            {
                return false;
            }

            var affirmativeResponses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "yes",
                "y",
                "true",
                "ok",
                "sure",
                "absolutely",
                "definitely",
                "of course",
                "affirmative",
                "yeah",
                "yep"
            };

            return affirmativeResponses.Contains(input.Trim());
        }

        public static bool StringIsNull(string? value)
        {
            return string.IsNullOrWhiteSpace(value);
        }
    }
}