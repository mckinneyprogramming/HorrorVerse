namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="MovieSeriesQueries"/> constants class.
    /// </summary>
    public class MovieSeriesQueries
    {
        /// <summary>
        /// Inserts series into the table.
        /// </summary>
        public const string InsertSeries = "INSERT INTO MovieSeries (Title, TotalTime, TotalMovies, Watched) VALUES (@Title, @TotalTime, @TotalMovies, @Watched)";

        /// <summary>
        /// Retrieves the movie series by name.
        /// </summary>
        public const string GetMovieSeriesByName = "SELECT * FROM MovieSeries WHERE Title = @Title";

        /// <summary>
        /// updates the movie series.
        /// </summary>
        public const string UpdateMovieSeries = "UPDATE MovieSeries SET Title = @Title, TotalTime = @TotalTime, TotalMovies = @TotalMovies, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the movie series.
        /// </summary>
        public const string DeleteMovieSeries = "DELETE FROM MovieSeries WHERE Id = @Id";

        /// <summary>
        /// Updates the total time for a given movie series.
        /// </summary>
        public const string UpdateTotalTime = "UPDATE MovieSeries SET TotalTime = (SELECT SUM(TotalTime) FROM Movie WHERE SeriesId = @SeriesId) WHERE Id = @SeriesId";

        /// <summary>
        /// Updates the total movies for a given movie series.
        /// </summary>
        public const string UpdateTotalMovies = "UPDATE MovieSeries SET TotalMovies = (SELECT COUNT(*) FROM Movie WHERE SeriesId = @SeriesId) WHERE Id = @SeriesId";

        /// <summary>
        /// Updates the movie series to watched if all the movies in the series are watched.
        /// </summary>
        public const string UpdateWatched = "UPDATE MovieSeries SET Watched = CASE WHEN (SELECT COUNT(*) FROM Movie WHERE SeriesId = @SeriesId AND Watched = 0) = 0 THEN 1 ELSE 0 END WHERE Id = @SeriesId";

        /// <summary>
        /// Gets the total time left to watch in the movie series.
        /// </summary>
        public const string GetTimeLeft = "SELECT SUM(TotalTime) FROM Movie WHERE SeriesId = @SeriesId AND Watched = 0";

        /// <summary>
        /// Gets a list of all the series.
        /// </summary>
        public const string GetAllSeries = "SELECT * FROM MovieSeries";
    }
}