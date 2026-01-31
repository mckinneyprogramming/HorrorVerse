namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// Provides a collection of SQL query strings for creating and querying tables related to movies, series,
    /// documentaries, shows, and episodes in the HorrorTracker database.
    /// </summary>
    /// <remarks>This static class centralizes SQL statements for database schema creation and aggregate
    /// queries, enabling consistent and maintainable access to table definitions and overall time calculations. All
    /// queries are designed for use with a PostgreSQL database and assume the presence of specific columns and data
    /// types as defined in the table creation statements.</remarks>
    public static class OverallQueries
    {
        private const string DecimalType = "DECIMAL(10, 2)";
        private const string PrimaryKey = "Id SERIAL PRIMARY KEY";
        private const string NotNull = "NOT NULL";
        private const string IntegerType = "INTEGER";
        private const string BooleanType = "BOOLEAN";
        private const string TotalTime = "TotalTime";
        private const string UnionAll = "UNION ALL";
        private const string Title = $"Title TEXT {NotNull}";

        /// <summary>
        /// Represents the SQL query used to check for the existence of a database named 'HorrorTracker' in PostgreSQL.
        /// </summary>
        /// <remarks>This query returns a result if the specified database exists. The parameter '@dbname'
        /// should be set to the name of the database to check.</remarks>
        public const string HorrorTrackerDatabaseConnection = "SELECT 1 FROM pg_database WHERE datname = @dbname";

        /// <summary>
        /// Represents the SQL statement used to create the MovieSeries table if it does not already exist.
        /// </summary>
        /// <remarks>The table includes columns for the primary key, title, total time, total number of
        /// movies, and watched status. The column types and constraints are defined by the referenced
        /// constants.</remarks>
        public const string CreateMovieSeriesTable = $@"
            CREATE TABLE IF NOT EXISTS MovieSeries (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                TotalMovies {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Represents the SQL statement used to create the Movie table if it does not already exist.
        /// </summary>
        /// <remarks>The statement defines columns for primary key, title, total time, series information,
        /// release year, and watched status. Column types and constraints are specified using predefined constants.
        /// This command is intended for use with database initialization routines.</remarks>
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
        /// Represents the SQL statement used to create the 'Documentary' table if it does not already exist.
        /// </summary>
        /// <remarks>The table includes columns for the primary key, title, total time, release year, and
        /// watched status. Column types and constraints are defined by the referenced constants. This statement is
        /// intended for use with SQL databases that support the 'CREATE TABLE IF NOT EXISTS' syntax.</remarks>
        public const string CreateDocumentaryTable = $@"
            CREATE TABLE IF NOT EXISTS Documentary (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                ReleaseYear {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Represents the SQL statement used to create the 'Show' table if it does not already exist.
        /// </summary>
        /// <remarks>The statement defines columns for primary key, title, total time, total episodes,
        /// number of seasons, and watched status. The column types and constraints are determined by the referenced
        /// constants.</remarks>
        public const string CreateShowTable = $@"
            CREATE TABLE IF NOT EXISTS Show (
                {PrimaryKey},
                {Title},
                {TotalTime} {DecimalType} {NotNull},
                TotalEpisodes {IntegerType} {NotNull},
                NumberOfSeasons {IntegerType} {NotNull},
                Watched {BooleanType} {NotNull})";

        /// <summary>
        /// Represents the SQL statement used to create the Episode table if it does not already exist.
        /// </summary>
        /// <remarks>The statement defines columns for the episode's primary key, title, associated show
        /// ID, release date, season, episode number, watched status, and total time. The column types and constraints
        /// are determined by the referenced constants. This string can be used when initializing or migrating the
        /// database schema.</remarks>
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
        /// Represents the SQL query used to calculate the total time across all movies, documentaries, and episodes.
        /// </summary>
        /// <remarks>This constant combines the total time from the Movie, Documentary, and Episode tables
        /// using UNION ALL, and then sums the results. The query assumes that the referenced columns and tables exist
        /// in the database schema.</remarks>
        public const string RetrieveOverallTime = $@"
            SELECT SUM({TotalTime}) FROM (
                SELECT {TotalTime} FROM Movie
                {UnionAll}
                SELECT {TotalTime} FROM Documentary
                {UnionAll}
                SELECT {TotalTime} FROM Episode) AS OverallTime";

        /// <summary>
        /// Represents the SQL query that calculates the total remaining time for all unwatched movies, documentaries,
        /// and episodes.
        /// </summary>
        /// <remarks>The query sums the 'TotalTime' values from the 'Movie', 'Documentary', and 'Episode'
        /// tables where the 'Watched' flag is set to false. This can be used to determine the overall time left to
        /// watch all unwatched content in the database.</remarks>
        public const string RetrieveOverallTimeLeft = $@"
            SELECT SUM({TotalTime}) FROM (
                SELECT {TotalTime} FROM Movie WHERE Watched = FALSE
                {UnionAll}
                SELECT {TotalTime} FROM Documentary WHERE Watched = FALSE
                {UnionAll}
                SELECT {TotalTime} FROM Episode WHERE Watched = FALSE) AS OverallTimeLeft";
    }
}