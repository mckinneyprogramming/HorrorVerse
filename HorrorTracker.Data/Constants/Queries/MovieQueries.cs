namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="MovieQueries"/> class.
    /// </summary>
    public static class MovieQueries
    {
        /// <summary>
        /// Inserts a movie in the database.
        /// </summary>
        public const string InsertMovie = "INSERT INTO Movie (Title, TotalTime, PartOfSeries, SeriesId, ReleaseYear, Watched) VALUES (@Title, @TotalTime, @PartOfSeries, @SeriesId, @ReleaseYear, @Watched)";

        /// <summary>
        /// Retrieves the movie by name.
        /// </summary>
        public const string GetMovieByName = "SELECT * FROM Movie WHERE Title = @Title";

        /// <summary>
        /// Updates the given movie.
        /// </summary>
        public const string UpdateMovie = "UPDATE Movie SET Title = @Title, TotalTime = @TotalTime, PartOfSeries = @PartOfSeries, SeriesId = @SeriesId, ReleaseYear = @ReleaseYear, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the selected movie from the database table.
        /// </summary>
        public const string DeleteMovie = "DELETE FROM Movie WHERE Id = @Id";

        /// <summary>
        /// Retrieves all the Movie from the database.
        /// </summary>
        public const string GetAllMovie = "SELECT * FROM Movie";

        /// <summary>
        /// Gets the Movie watched in a given series.
        /// </summary>
        public const string GetWatchedMovieBySeriesName = "SELECT * FROM Movie WHERE SeriesId = (SELECT Id FROM Series WHERE Title = @Title) AND Watched = TRUE";

        /// <summary>
        /// Gets the Movie that are unwatched in a given series.
        /// </summary>
        public const string GetUnwatchedMovieBySeriesName = "SELECT * FROM Movie WHERE SeriesId = (SELECT Id FROM Series WHERE Title = @Title) AND Watched = FALSE";

        /// <summary>
        /// Retrieves the watched Movie from the database.
        /// </summary>
        public const string GetWatchedMovie = "SELECT * FROM Movie WHERE Watched = TRUE";

        /// <summary>
        /// Retrieves the unwatched Movie from the database.
        /// </summary>
        public const string GetUnwatchedMovie = "SELECT * FROM Movie WHERE Watched = FALSE";

        /// <summary>
        /// Retrieves the total time of the watched Movie.
        /// </summary>
        public const string GetTotalTimeOfWatchedMovie = "SELECT SUM(TotalTime) FROM Movie WHERE Watched = TRUE";

        /// <summary>
        /// Retrieves the time left of unwatched Movie.
        /// </summary>
        public const string GetTimeLeftOfUnwatchedMovie = "SELECT SUM(TotalTime) FROM Movie WHERE Watched = FALSE";
    }
}