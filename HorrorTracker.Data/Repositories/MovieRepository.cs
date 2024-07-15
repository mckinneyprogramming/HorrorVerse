using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieRepository"/> class.
    /// </summary>
    /// <seealso cref="IMovieRepository"/>
    public class MovieRepository : RepositoryBase<Movie>, IMovieRepository
    {
        /// <summary>
        /// The database connection.
        /// </summary>
        private readonly IDatabaseConnection _databaseConnection;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILoggerService _logger;

        /// <summary>
        /// The logger helper.
        /// </summary>
        private readonly DatabaseConnectionsHelper _databaseConnectionsHelper;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeriesRepository"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public MovieRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(databaseConnection, logger);
        }

        /// <inheritdoc/>
        public override int Add(Movie movie)
        {
            var result = 0;
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieQueries.InsertMovie;
                var parameters = MovieDatabaseParameters.InsertMovieParameters(movie);
                result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    _logger.LogInformation($"Movie '{movie.Title}' added successfully.");
                    return result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error adding movie '{movie.Title}'.", ex);
                return result;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc/>
        public override IEnumerable<Movie> GetAll()
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc/>
        public override Movie? GetByTitle(string title)
        {
            Movie? movie = null;
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieQueries.GetMovieByName;
                var parameters = SharedDatabaseParameters.GetByTitleParameters(title);
                using var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, query, parameters);
                if (reader.Read())
                {
                    movie = new Movie(reader.GetString(1), reader.GetDecimal(2), reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt32(5), reader.GetBoolean(6), reader.GetInt32(0));
                    _logger.LogInformation($"Movie '{movie.Title}' was found in the database.");
                    return movie;
                }
                else
                {
                    _logger.LogWarning($"Movie '{title}' not found in the database.");
                    return movie;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("An error occurred while getting the movie by name.", ex);
                return movie;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public override IEnumerable<Movie> GetUnwatchedOrWatchedByTitle(string name, string query)
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc/>
        public override string Update(Movie entity)
        {
            throw new NotImplementedException();
        }
    }
}