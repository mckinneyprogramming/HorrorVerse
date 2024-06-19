namespace HorrorTracker.Data.Constants.Queries
{
    /// <summary>
    /// The <see cref="OverallQueries"/> constants class.
    /// </summary>
    public class OverallQueries
    {
        /// <summary>
        /// Selecting the database from the Postgre server.
        /// </summary>
        public const string HorrorTrackerDatabaseConnection = "SELECT 1 FROM pg_database WHERE datname = @dbname";

        /// <summary>
        /// Creates the series table.
        /// </summary>
        public const string CreateSeriesTable = "CREATE TABLE IF NOT EXISTS Series (" +
                    "Id SERIAL PRIMARY KEY," +
                    "Title TEXT," +
                    "TotalTime INT," +
                    "TotalMovies INT," +
                    "Watched BOOLEAN)";

        /// <summary>
        /// Retrieves the overall time in the database.
        /// </summary>
        public const string RetrieveOverallTime = "SELECT SUM(TotalTime) FROM (" +
            "SELECT TotalTime FROM Movies\n" +
            "UNION ALL\n" +
            "SELECT TotalTime FROM Documentaries\n" +
            "UNION ALL\n" +
            "SELECT TotalTime FROM Episodes\n)" +
            " AS OverallTime";

        /// <summary>
        /// Retrieves the overall time left in the database.
        /// </summary>
        public const string RetrievesOverallTimeLeft = "SELECT SUM(TotalTime) FROM (" +
            "SELECT TotalTime FROM Movies WHERE Watched = 0\n" +
            "UNION ALL\n" +
            "SELECT TotalTime FROM Documentaries WHERE Watched = 0\n" +
            "UNION ALL\n" +
            "SELECT TotalTime FROM Episodes WHERE Watched = 0)" +
            " AS OverallTimeLeft";
    }
}