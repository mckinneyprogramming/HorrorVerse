namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="EpisodeQueries"/> class.
    /// </summary>
    public class EpisodeQueries
    {
        /// <summary>
        /// Adds a new episode to the database.
        /// </summary>
        public const string InsertEpisode = "INSERT INTO Episodes (Title, TotalTime, ShowId, ReleaseDate, Watched) VALUES (@Title, @TotalTime, @ShowId, @ReleaseDate, @Watched)";

        /// <summary>
        /// Retrieves the episode by the name.
        /// </summary>
        public const string GetEpisodeByName = "SELECT * FROM Episodes WHERE Title = @Title";

        /// <summary>
        /// Updates the episode in the database.
        /// </summary>
        public const string UpdateEpisode = "UPDATE Episodes SET Title = @Title, TotalTime = @TotalTime, ShowId = @ShowId, ReleaseDate = @ReleaseDate, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the choosen episode from the database.
        /// </summary>
        public const string DeleteEpisode = "DELETE FROM Episodes WHERE Id = @Id";

        /// <summary>
        /// Retrieves a list of all the episodes.
        /// </summary>
        public const string GetAllEpisodes = "SELECT * FROM Episodes";

        /// <summary>
        /// Retrieves the watched episodes.
        /// </summary>
        public const string GetWatchedEpisodes = "SELECT * FROM Episodes WHERE Watched = 1";

        /// <summary>
        /// Retrieves the unwatched episodes.
        /// </summary>
        public const string GetUnwatchedEpisodes = "SELECT * FROM Episodes WHERE Watched = 0";

        /// <summary>
        /// Retrieves the watched episodes of the show based on the show name.
        /// </summary>
        public const string GetWatchedEpisodesByShowName = "SELECT * FROM Episodes WHERE ShowId = (SELECT Id FROM Shows WHERE Title = @ShowName) AND Watched = 1";

        /// <summary>
        /// Retrieves the unwatched episodes of a show based on the show name.
        /// </summary>
        public const string GetUnwatchedEpisodesByShowName = "SELECT * FROM Episodes WHERE ShowId = (SELECT Id FROM Shows WHERE Title = @ShowName) AND Watched = 0";
    }
}