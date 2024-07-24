using System.Data;

namespace HorrorTracker.Data.Models.Helpers
{
    /// <summary>
    /// The <see cref="ModelDataReader"/> class.
    /// </summary>
    public static class ModelDataReader
    {
        /// <summary>
        /// Retrieves the movies series function for the execute reader.
        /// </summary>
        /// <returns>The function.</returns>
        public static Func<IDataReader, MovieSeries> MovieSeriesFunction()
        {
            return reader => new MovieSeries(reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0));
        }

        /// <summary>
        /// Retrieves the movie function for the execute reader.
        /// </summary>
        /// <returns>The function.</returns>
        public static Func<IDataReader, Movie> MovieFunction()
        {
            return reader => new Movie(
                            reader.GetString(1),
                            reader.GetDecimal(2),
                            reader.GetBoolean(3),
                            reader.GetInt32(4),
                            reader.GetInt32(5),
                            reader.GetBoolean(6),
                            reader.GetInt32(0));
        }
    }
}