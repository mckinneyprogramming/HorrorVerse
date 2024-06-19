namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="MovieQueries"/> class.
    /// </summary>
    public class MovieQueries
    {
        /// <summary>
        /// Inserts a movie in the database.
        /// </summary>
        public const string InsertMovie = "INSERT INTO Movies (Title, TotalTime, PartOfSeries, SeriesId, ReleaseYear, Watched) VALUES (@Title, @TotalTime, @PartOfSeries, @SeriesId, @ReleaseYear, @Watched)";

        /// <summary>
        /// Retrieves the movie by name.
        /// </summary>
        public const string GetMovieByName = "SELECT * FROM Movies WHERE Title = @Title";

        /// <summary>
        /// Updates the given movie.
        /// </summary>
        public const string UpdateMovie = "UPDATE Movies SET Title = @Title, TotalTime = @TotalTime, PartOfSeries = @PartOfSeries, SeriesId = @SeriesId, ReleaseYear = @ReleaseYear, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the selected movie from the database table.
        /// </summary>
        public const string DeleteMovie = "DELETE FROM Movies WHERE Id = @Id";

        /// <summary>
        /// Retrieves all the movies from the database.
        /// </summary>
        public const string GetAllMovies = "SELECT * FROM Movies";

        /// <summary>
        /// Gets the movies watched in a given series.
        /// </summary>
        public const string GetWatchedMoviesBySeriesName = "SELECT * FROM Movies WHERE SeriesId = (SELECT Id FROM Series WHERE Title = @SeriesName) AND Watched = 1";

        /// <summary>
        /// Gets the movies that are unwatched in a given series.
        /// </summary>
        public const string GetUnwathcedMoviesBySeriesName = "SELECT * FROM Movies WHERE SeriesId = (SELECT Id FROM Series WHERE Title = @SeriesName) AND Watched = 0";

        /// <summary>
        /// Retrieves the watched movies from the database.
        /// </summary>
        public const string GetWatchedMovies = "SELECT * FROM Movies WHERE Watched = 1";

        /// <summary>
        /// Retrieves the unwatched movies from the database.
        /// </summary>
        public const string GetUnwatchedMovies = "SELECT * FROM Movies WHERE Watched = 0";

        /// <summary>
        /// Retrieves the total time of the watched movies.
        /// </summary>
        public const string GetTotalTimeOfWatchedMovies = "SELECT SUM(TotalTime) FROM Movies WHERE Watched = 1";

        /// <summary>
        /// Retrieves the time left of unwatched movies.
        /// </summary>
        public const string GetTimeLeftOfUnwatchedMovies = "SELECT SUM(TotalTime) FROM Movies WHERE Watched = 0";
    }
}