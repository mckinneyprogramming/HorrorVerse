namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="ShowQueries"/> class.
    /// </summary>
    public class ShowQueries
    {
        /// <summary>
        /// Inserts a new show into the database.
        /// </summary>
        public const string InsertShow = "INSERT INTO Show (Title, TotalTime, TotalEpisodes, NumberOfSeasons, Watched) VALUES (@Title, @TotalTime, @TotalEpisodes, @NumberOfSeasons, @Watched)";

        /// <summary>
        /// Retrieves a show from the database based on a show name.
        /// </summary>
        public const string GetShowByName = "SELECT * FROM Show WHERE Title = @Title";

        /// <summary>
        /// Updates the show based on the show id.
        /// </summary>
        public const string UpdateShow = "UPDATE Show SET Title = @Title, TotalTime = @TotalTime, TotalEpisodes = @TotalEpisodes, NumberOfSeasons = @NumberOfSeasons, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the show based on the show id.
        /// </summary>
        public const string DeleteShow = "DELETE FROM Show WHERE Id = @Id";

        /// <summary>
        /// Retrieves a list of all the Show in the database.
        /// </summary>
        public const string GetAllShow = "SELECT * FROM Show";

        /// <summary>
        /// Retrieves the watched Show.
        /// </summary>
        public const string GetWatchedShow = "SELECT * FROM Show WHERE Watched = 1";

        /// <summary>
        /// Retrieves the unwatched Show.
        /// </summary>
        public const string GetUnwatchedShow = "SELECT * FROM Show WHERE Watched = 0";

        /// <summary>
        /// Retrieves the total time watched of the watched Show.
        /// </summary>
        public const string GetTotalTimeOfWatchedShow = "SELECT SUM(TotalTime) FROM Show WHERE Watched = 1";

        /// <summary>
        /// Retrieves the time left of the unwatched Show.
        /// </summary>
        public const string GetTimeLeftOfUnwatchedShow = "SELECT SUM(TotalTime) FROM Show WHERE Watched = 0";

        /// <summary>
        /// Updates the total time of the show based episode times.
        /// </summary>
        public const string UpdateTotalTime = "UPDATE Show SET TotalTime = (SELECT SUM(TotalTime) FROM Episode WHERE ShowId = @ShowId) WHERE Id = @ShowId";

        /// <summary>
        /// Updates the show to watched if all the episodes in the show are watched.
        /// </summary>
        public const string UpdateWatched = "UPDATE Show SET Watched = CASE WHEN (SELECT COUNT(*) FROM Episode WHERE ShowId = @ShowId AND Watched = 0) = 0 THEN 1 ELSE 0 END WHERE Id = @ShowId";
    }
}