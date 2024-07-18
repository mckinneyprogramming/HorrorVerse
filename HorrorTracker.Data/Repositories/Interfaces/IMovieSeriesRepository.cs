using HorrorTracker.Data.Models;

namespace HorrorTracker.Data.Repositories.Interfaces
{
    /// <summary>
    /// The <see cref="IMovieSeriesRepository"/> interface.
    /// </summary>
    public interface IMovieSeriesRepository
    {
        /// <summary>
        /// Retrieves all the items that are unwatched or watched.
        /// </summary>
        /// <param name="title">The title of the object.</param>
        /// <param name="query">The query.</param>
        /// <returns>The list/array of items.</returns>
        IEnumerable<MovieSeries> GetUnwatchedOrWatchedByTitle(string title, string query);

        /// <summary>
        /// Updates the total time for a given movie series.
        /// </summary>
        /// <param name="seriesId">Teh series id.</param>
        /// <returns>Message status.</returns>
        string UpdateTotalTime(int seriesId);

        /// <summary>
        /// Updates the total time for the movie series.
        /// </summary>
        /// <param name="seriesId">The series id.</param>
        /// <returns>The message status.</returns>
        string UpdateTotalMovies(int seriesId);

        /// <summary>
        /// Updates the watched for the movie series.
        /// </summary>
        /// <param name="seriesId">The series id.</param>
        /// <returns>The message status.</returns>
        string UpdateWatched(int seriesId);

        /// <summary>
        /// Retrieves the total time left to watch in the series.
        /// </summary>
        /// <param name="seriesId">The series id.</param>
        /// <returns></returns>
        decimal GetTimeLeft(int seriesId);
    }
}