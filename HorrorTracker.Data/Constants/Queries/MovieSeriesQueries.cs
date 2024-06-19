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
        public const string InsertSeries = "INSERT INTO Series (Title, TotalTime, TotalMovies, Watched) VALUES (@Title, @TotalTime, @TotalMovies, @Watched)";

        /// <summary>
        /// Retrieves the movie series by name.
        /// </summary>
        public const string GetMovieSeriesByName = "SELECT * FROM Series WHERE Title = @Title";

        /// <summary>
        /// updates the movie series.
        /// </summary>
        public const string UpdateMovieSeries = "UPDATE Series SET Title = @Title, TotalTime = @TotalTime, TotalMovies = @TotalMovies, Watched = @Watched WHERE Id = @Id";

        /// <summary>
        /// Deletes the movie series.
        /// </summary>
        public const string DeleteMovieSeries = "DELETE FROM Series WHERE Id = @Id";

        /// <summary>
        /// Gets the movies watched in a given series.
        /// </summary>
        public const string GetWatchedMoviesBySeriesName = "SELECT * FROM Movies WHERE SeriesId = (SELECT Id FROM Series WHERE Title = @SeriesName) AND Watched = 1";

        /// <summary>
        /// Gets the movies that are unwatched in a given series.
        /// </summary>
        public const string GetUnwathcedMoviesBySeriesName = "SELECT * FROM Movies WHERE SeriesId = (SELECT Id FROM Series WHERE Title = @SeriesName) AND Watched = 0";
    }
}