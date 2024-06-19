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
        public const string InsertShow = "INSERT INTO Shows (Title, TotalTime, TotalEpisodes, Years, Watched) VALUES (@Title, @TotalTime, @TotalEpisodes, @Years, @Watched)";

        /// <summary>
        /// Retrieves a show from the database based on a show name.
        /// </summary>
        public const string GetShowByName = "SELECT * FROM Shows WHERE Title = @Title";

        /// <summary>
        /// Updates the show based on the show id.
        /// </summary>
        public const string UpdateShow = "UPDATE Shows SET Title = @Title, TotalTime = @TotalTime, TotalEpisodes = @TotalEpisodes, Years = @Years, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the show based on the show id.
        /// </summary>
        public const string DeleteShow = "DELETE FROM Shows WHERE Id = @Id";

        /// <summary>
        /// Retrieves a list of all the shows in the database.
        /// </summary>
        public const string GetAllShows = "SELECT * FROM Shows";

        /// <summary>
        /// Retrieves the watched shows.
        /// </summary>
        public const string GetWatchedShows = "SELECT * FROM Shows WHERE Watched = 1";

        /// <summary>
        /// Retrieves the unwatched shows.
        /// </summary>
        public const string GetUnwatchedShows = "SELECT * FROM Shows WHERE Watched = 0";

        /// <summary>
        /// Retrieves the total time watched of the watched shows.
        /// </summary>
        public const string GetTotalTimeOfWatchedShows = "SELECT SUM(TotalTime) FROM Shows WHERE Watched = 1";

        /// <summary>
        /// Retrieves the time left of the unwatched shows.
        /// </summary>
        public const string GetTimeLeftOfUnwatchedShows = "SELECT SUM(TotalTime) FROM Shows WHERE Watched = 0";

        /// <summary>
        /// Updates the total time of the show based episode times.
        /// </summary>
        public const string UpdateTotalTime = "UPDATE Shows SET TotalTime = (SELECT SUM(TotalTime) FROM Episodes WHERE ShowId = @ShowId) WHERE Id = @ShowId";

        /// <summary>
        /// Updates the show to watched if all the episodes in the show are watched.
        /// </summary>
        public const string UpdateWatched = "UPDATE Shows SET Watched = CASE WHEN (SELECT COUNT(*) FROM Episodes WHERE ShowId = @ShowId AND Watched = 0) = 0 THEN 1 ELSE 0 END WHERE Id = @ShowId";
    }
}