using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieSeriesRepository"/> class.
    /// </summary>
    public class MovieSeriesRepository : IMovieSeriesRepository
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
        public MovieSeriesRepository(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(databaseConnection, logger);
        }

        /// <inheritdoc/>
        public int AddMovieSeries(MovieSeries series)
        {
            int result = 0;
            try
            {
                _databaseConnectionsHelper.Open();

                var addSeriesCommandText = MovieSeriesQueries.InsertSeries;
                var parameters = MovieSeriesDatabaseParameters.InsertMovieSeriesParameters(series);

                result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, addSeriesCommandText, parameters);
                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    _logger.LogInformation($"Movie series {series.Title} was added successfully.");
                    return result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Adding a movie series to the database failed.", ex);
                return result;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }

        /// <inheritdoc/>
        public MovieSeries? GetMovieSeriesByName(string seriesName)
        {
            MovieSeries? movieSeries = null;
            try
            {
                _databaseConnectionsHelper.Open();

                var commandText = MovieSeriesQueries.GetMovieSeriesByName;
                var parameters = SharedDatabaseParameters.GetByTitleParameters(seriesName);

                using (var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, commandText, parameters))
                {
                    if (reader.Read())
                    {
                        movieSeries = new MovieSeries(reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0))
                        {
                            Title = reader.GetString(1)
                        };

                        _logger.LogInformation($"Movie series {seriesName} was found in the database.");
                        return movieSeries;
                    }
                    else
                    {
                        _logger.LogWarning($"Movie series {seriesName} was not found in the database.");
                        return movieSeries;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("An error occurred while getting the movie series by name.", ex);
                return movieSeries;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public void UpdateSeries(MovieSeries series)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.UpdateMovieSeries;
                var parameters = MovieSeriesDatabaseParameters.UpdateMovieSeriesParameters(series);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (result == 1)
                {
                    _logger.LogInformation($"Series '{series.Title}' updated successfully.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error updating series '{series.Title}'.", ex);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public void DeleteSeries(int id)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.DeleteMovieSeries;
                var parameters = MovieSeriesDatabaseParameters.DeleteMovieSeriesParameters(id);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (result == 1)
                {
                    _logger.LogInformation($"Series with ID '{id}' deleted successfully.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting series with ID '{id}'.", ex);
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public IEnumerable<Movie> GetUnwatchedOrWatchedMoviesBySeriesName(string seriesName, string query)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var parameters = SharedDatabaseParameters.GetByTitleParameters(seriesName);
                using var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, query, parameters);
                var movies = new List<Movie>();

                while (reader.Read())
                {
                    var movie = new Movie(reader.GetString(1), reader.GetDecimal(2), reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt32(5), reader.GetBoolean(6), reader.GetInt32(0))
                    {
                        Title = reader.GetString(1)
                    };

                    movies.Add(movie);
                }

                _logger.LogInformation($"Retrieved {movies.Count} movie(s) successfully.");
                return movies;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching movies for series '{seriesName}'.", ex);
                return [];
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }
    }
}