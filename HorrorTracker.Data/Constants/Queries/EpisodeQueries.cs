namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="EpisodeQueries"/> class.
    /// </summary>
    public static class EpisodeQueries
    {
        /// <summary>
        /// Adds a new episode to the database.
        /// </summary>
        public const string InsertEpisode = "INSERT INTO Episode (Title, ShowId, ReleaseDate, Season, EpisodeNumber, Watched, TotalTime) VALUES (@Title, @ShowId, @ReleaseDate, @Season, @EpisodeNumber, @Watched, @TotalTime)";

        /// <summary>
        /// Retrieves the episode by the name.
        /// </summary>
        public const string GetEpisodeByName = "SELECT * FROM Episode WHERE Title = @Title";

        /// <summary>
        /// Updates the episode in the database.
        /// </summary>
        public const string UpdateEpisode = "UPDATE Episode SET Title = @Title, ShowId = @ShowId, ReleaseDate = @ReleaseDate, Season = @Season, EpisodeNumber = @EpisodeNumber, Watched = @Watched, TotalTime = @TotalTime WHERE Id = @Id";

        /// <summary>
        /// Deletes the choosen episode from the database.
        /// </summary>
        public const string DeleteEpisode = "DELETE FROM Episode WHERE Id = @Id";

        /// <summary>
        /// Retrieves a list of all the episodes.
        /// </summary>
        public const string GetAllEpisodes = "SELECT * FROM Episode";

        /// <summary>
        /// Retrieves the watched episodes.
        /// </summary>
        public const string GetWatchedEpisodes = "SELECT * FROM Episode WHERE Watched = TRUE";

        /// <summary>
        /// Retrieves the unwatched episodes.
        /// </summary>
        public const string GetUnwatchedEpisodes = "SELECT * FROM Episode WHERE Watched = FALSE";

        /// <summary>
        /// Retrieves the watched episodes of the show based on the show name.
        /// </summary>
        public const string GetWatchedEpisodesByShowName = "SELECT * FROM Episode WHERE ShowId = (SELECT Id FROM Show WHERE Title = @Title) AND Watched = TRUE";

        /// <summary>
        /// Retrieves the unwatched episodes of a show based on the show name.
        /// </summary>
        public const string GetUnwatchedEpisodesByShowName = "SELECT * FROM Episode WHERE ShowId = (SELECT Id FROM Show WHERE Title = @Title) AND Watched = FALSE";
    }
}