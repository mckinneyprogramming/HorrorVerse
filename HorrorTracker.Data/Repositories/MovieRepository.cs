using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using System.Data;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieRepository"/> class.
    /// </summary>
    /// <seealso cref="IMovieRepository"/>
    public class MovieRepository : RepositoryBase<Movie>, IMovieRepository
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeriesRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public MovieRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
            : base(databaseConnection, logger)
        {
        }

        /// <inheritdoc/>
        public override int Add(Movie movie)
        {
            return ExecuteNonQuery(
                MovieQueries.InsertMovie,
                MovieDatabaseParameters.InsertMovieParameters(movie),
                $"Movie '{movie.Title}' added successfully.",
                $"Error adding movie '{movie.Title}'.");
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            return ExecuteNonQuery(
                MovieQueries.DeleteMovie,
                SharedDatabaseParameters.IdParameters(id),
                "Deleting movie was not successful.",
                $"Movie with ID '{id}' deleted successfully.",
                $"Error deleting movie with ID '{id}'.");
        }

        /// <inheritdoc/>
        public override IEnumerable<Movie> GetAll()
        {
            return ExecuteReaderList(
                MovieQueries.GetAllMovie,
                null,
                MovieFunction(),
                "Successfully retrieved all of the movies.",
                "Error fetching all of the movies.");
        }

        /// <inheritdoc/>
        public override Movie? GetByTitle(string title)
        {
            return ExecuteReader(
                MovieQueries.GetMovieByName,
                SharedDatabaseParameters.GetByTitleParameters(title),
                MovieFunction(),
                $"Movie '{title}' was found in the database.",
                $"Movie '{title}' not found in the database.",
                "An error occurred while getting the movie by name.");
        }

        /// <inheritdoc/>
        public override string Update(Movie entity)
        {
            return ExecuteNonQuery(
                MovieQueries.UpdateMovie,
                MovieDatabaseParameters.UpdateMovieParameters(entity),
                "Updating movie was not successful.",
                $"Movie '{entity.Title}' updated successfully.",
                $"Error updating movie '{entity.Title}'.");
        }

        /// <inheritdoc/>
        public IEnumerable<Movie> GetUnwatchedOrWatchedMovies(string query)
        {
            if (query.Contains("Watched = TRUE"))
            {
                return ExecuteReaderList(
                    MovieQueries.GetWatchedMovie,
                    null,
                    MovieFunction(),
                    "Successfully retrieved list of watched movies.",
                    "Error fetching watched movies.");
            }

            return ExecuteReaderList(
                MovieQueries.GetWatchedMovie,
                null,
                MovieFunction(),
                "Successfully retrieved list of unwatched movies.",
                "Error fetching unwatched movies.");
        }

        /// <inheritdoc/>
        public decimal GetTime(string query)
        {
            if (QueryContainsWatched(query))
            {
                return ExecuteScalar(query, null, "Error fetching total time of watched movies.");
            }

            return ExecuteScalar(query, null, "Error fetching time left of unwatched movies.");
        }

        /// <summary>
        /// Retrieves the movie function for the execute reader.
        /// </summary>
        /// <returns>The function.</returns>
        private static Func<IDataReader, Movie> MovieFunction()
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