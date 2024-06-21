namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="OverallQueries"/> constants class.
    /// </summary>
    public static class OverallQueries
    {
        private const string DecimalType = "DECIMAL(5, 2)";
        private const string PrimaryKey = "Id SERIAL PRIMARY KEY";
        private const string NotNull = "NOT NULL";
        private const string IntegerType = "INTEGER";
        private const string BooleanType = "BOOLEAN";
        private const string TotalTime = "TotalTime";
        private const string UnionAll = "UNION ALL";
        private const string Title = $"Title TEXT {NotNull}";

        /// <summary>
        /// Selecting the database from the Postgre server.
        /// </summary>
        public const string HorrorTrackerDatabaseConnection = "SELECT 1 FROM pg_database WHERE datname = @dbname";

        /// <summary>
        /// Creates the movie series table.
        /// </summary>
        public const string CreateMovieSeriesTable = $@"
            CREATE TABLE IF NOT EXISTS MovieSeries (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                TotalMovies {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Creates the movie table.
        /// </summary>
        public const string CreateMovieTable = $@"
            CREATE TABLE IF NOT EXISTS Movie (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                PartOfSeries {BooleanType} {NotNull},
                SeriesId {IntegerType},
                ReleaseYear {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Creates the documentary table.
        /// </summary>
        public const string CreateDocumentaryTable = $@"
            CREATE TABLE IF NOT EXISTS Documentary (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                ReleaseYear {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Creates the show table.
        /// </summary>
        public const string CreateShowTable = $@"
            CREATE TABLE IF NOT EXISTS Show (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                TotalEpisodes {IntegerType} {NotNull},
                NumberOfSeasons {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Creates the episode table.
        /// </summary>
        public const string CreateEpisodeTable = $@"
            CREATE TABLE IF NOT EXISTS Episode (
                {PrimaryKey},
                {Title},
                ShowId {IntegerType} {NotNull},
                ReleaseDate DATE {NotNull},
                Season {IntegerType} {NotNull},
                EpisodeNumber {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull},
                {TotalTime} {DecimalType} {NotNull})";

        /// <summary>
        /// Retrieves the overall time in the database.
        /// </summary>
        public const string RetrieveOverallTime = $@"
            SELECT SUM({TotalTime}) FROM (
                SELECT {TotalTime} FROM Movie
                {UnionAll}
                SELECT {TotalTime} FROM Documentary
                {UnionAll}
                SELECT {TotalTime} FROM Episode) AS OverallTime";

        /// <summary>
        /// Retrieves the overall time left in the database.
        /// </summary>
        public const string RetrieveOverallTimeLeft = $@"
            SELECT SUM({TotalTime}) FROM (
                SELECT {TotalTime} FROM Movie WHERE Watched = 0
                {UnionAll}
                SELECT {TotalTime} FROM Documentary WHERE Watched = 0
                {UnionAll}
                SELECT {TotalTime} FROM Episode WHERE Watched = 0) AS OverallTimeLeft";
    }
}