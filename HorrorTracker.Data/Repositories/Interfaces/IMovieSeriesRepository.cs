using HorrorTracker.Data.Models;

namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IMovieSeriesRepository"/> interface.
    /// </summary>
    public interface IMovieSeriesRepository
    {
        /// <summary>
        /// Adds a movie series to the database.
        /// </summary>
        /// <param name="series">The movie series.</param>
        /// <returns>The status.</returns>
        int AddMovieSeries(MovieSeries series);

        /// <summary>
        /// Retrieves the movie series by name.
        /// </summary>
        /// <param name="seriesName">The series name.</param>
        /// <returns>The movie series.</returns>
        MovieSeries? GetMovieSeriesByName(string seriesName);

        /// <summary>
        /// Updates the movie series.
        /// </summary>
        /// <param name="series">The movie series.</param>
        void UpdateSeries(MovieSeries series);

        /// <summary>
        /// Deletes the movie series.
        /// </summary>
        /// <param name="id">The movie series id.</param>
        void DeleteSeries(int id);
    }
}