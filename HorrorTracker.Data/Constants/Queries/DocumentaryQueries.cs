namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="DocumentaryQueries"/> class.
    /// </summary>
    public static class DocumentaryQueries
    {
        /// <summary>
        /// Inserts a new documentary into the database.
        /// </summary>
        public const string InsertDocumentary = "INSERT INTO Documentary (Title, TotalTime, ReleaseYear, Watched) VALUES (@Title, @TotalTime, @ReleaseYear, @Watched)";

        /// <summary>
        /// Retrieves the documentary by name.
        /// </summary>
        public const string GetDocumentaryByName = "SELECT * FROM Documentary WHERE Title = @Title";

        /// <summary>
        /// Updates the selected documentary in the database.
        /// </summary>
        public const string UpdateDocumentary = "UPDATE Documentary SET Title = @Title, TotalTime = @TotalTime, ReleaseYear = @ReleaseYear, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the selected documentary from the database.
        /// </summary>
        public const string DeleteDocumentary = "DELETE FROM Documentary WHERE Id = @Id";

        /// <summary>
        /// Retrieves all the Documentary from the database.
        /// </summary>
        public const string GetAllDocumentary = "SELECT * FROM Documentary";

        /// <summary>
        /// Retrieves the watched Documentary.
        /// </summary>
        public const string GetWatchedDocumentary = "SELECT * FROM Documentary WHERE Watched = 1";

        /// <summary>
        /// Retrieves the unwatched Documentary.
        /// </summary>
        public const string GetUnwatchedDocumentary = "SELECT * FROM Documentary WHERE Watched = 0";

        /// <summary>
        /// Retrieves the total time of the watched Documentary.
        /// </summary>
        public const string GetTotalTimeOfWatchedDocumentary = "SELECT SUM(TotalTime) FROM Documentary WHERE Watched = 1";

        /// <summary>
        /// Retrieves the time left of the unwatched Documentary.
        /// </summary>
        public const string GetTimeLeftOfUnwatchedDocumentary = "SELECT SUM(TotalTime) FROM Documentary WHERE Watched = 0";
    }
}