namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="DocumentaryQueries"/> class.
    /// </summary>
    public class DocumentaryQueries
    {
        /// <summary>
        /// Inserts a new documentary into the database.
        /// </summary>
        public const string InsertDocumentary = "INSERT INTO Documentaries (Title, TotalTime, ReleaseYear, Watched) VALUES (@Title, @TotalTime, @ReleaseYear, @Watched)";

        /// <summary>
        /// Retrieves the documentary by name.
        /// </summary>
        public const string GetDocumentaryByName = "SELECT * FROM Documentaries WHERE Title = @Title";

        /// <summary>
        /// Updates the selected documentary in the database.
        /// </summary>
        public const string UpdateDocumentary = "UPDATE Documentaries SET Title = @Title, TotalTime = @TotalTime, ReleaseYear = @ReleaseYear, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the selected documentary from the database.
        /// </summary>
        public const string DeleteDocumentary = "DELETE FROM Documentaries WHERE Id = @Id";

        /// <summary>
        /// Retrieves all the documentaries from the database.
        /// </summary>
        public const string GetAllDocumentaries = "SELECT * FROM Documentaries";

        /// <summary>
        /// Retrieves the watched documentaries.
        /// </summary>
        public const string GetWatchedDocumentaries = "SELECT * FROM Documentaries WHERE Watched = 1";

        /// <summary>
        /// Retrieves the unwatched documentaries.
        /// </summary>
        public const string GetUnwatchedDocumentaries = "SELECT * FROM Documentaries WHERE Watched = 0";

        /// <summary>
        /// Retrieves the total time of the watched documentaries.
        /// </summary>
        public const string GetTotalTimeOfWatchedDocumentaries = "SELECT SUM(TotalTime) FROM Documentaries WHERE Watched = 1";

        /// <summary>
        /// Retrieves the time left of the unwatched documentaries.
        /// </summary>
        public const string GetTimeLeftOfUnwatchedDocumentaries = "SELECT SUM(TotalTime) FROM Documentaries WHERE Watched = 0";
    }
}