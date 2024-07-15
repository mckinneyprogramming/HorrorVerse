using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories.Abstractions;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.Data.Repositories
{
    /// <summary>
    /// The <see cref="MovieSeriesRepository"/> class.
    /// </summary>
    public class MovieSeriesRepository : RepositoryBase<MovieSeries>, IMovieSeriesRepository
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
        public override int Add(MovieSeries series)
        {
            var result = 0;
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
        public override MovieSeries? GetByName(string seriesName)
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
                        movieSeries = new MovieSeries(reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0));

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
        public override string Update(MovieSeries series)
        {
            var message = "Updating movie series was not successful.";
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.UpdateMovieSeries;
                var parameters = MovieSeriesDatabaseParameters.UpdateMovieSeriesParameters(series);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    message = "Series updated successfully.";
                    _logger.LogInformation(message);
                    return message;
                }
            }
            catch (Exception ex)
            {
                message = $"Error updating series '{series.Title}'.";
                _logger.LogError(message, ex);
                return message;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return message;
        }

        /// <inheritdoc/>
        public override string Delete(int id)
        {
            var message = "Deleting movie series was not successful.";
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.DeleteMovieSeries;
                var parameters = SharedDatabaseParameters.IdParameters(id);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    message = $"Series with ID '{id}' deleted successfully.";
                    _logger.LogInformation(message);
                    return message;
                }
            }
            catch (Exception ex)
            {
                message = $"Error deleting series with ID '{id}'.";
                _logger.LogError(message, ex);
                return message;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return message;
        }

        /// <inheritdoc/>
        public override IEnumerable<MovieSeries> GetUnwatchedOrWatchedByName(string seriesName, string query)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var parameters = SharedDatabaseParameters.GetByTitleParameters(seriesName);
                using var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, query, parameters);
                var moviesSeries = new List<MovieSeries>();

                while (reader.Read())
                {
                    var newSeries = new MovieSeries(reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0));
                    moviesSeries.Add(newSeries);
                }

                _logger.LogInformation($"Retrieved {moviesSeries.Count} movie series(s) successfully.");
                return moviesSeries;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching series's '{seriesName}'.", ex);
                return [];
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public string UpdateTotalTime(int seriesId)
        {
            var message = "Updating total time for the series was not successful.";
            try
            {
                _databaseConnectionsHelper.Open();

                var query = MovieSeriesQueries.UpdateTotalTime;
                var parameters = SharedDatabaseParameters.IdParameters(seriesId);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    message = $"Total time for series ID '{seriesId}' updated successfully.";
                    _logger.LogInformation(message);
                    return message;
                }
            }
            catch (Exception ex)
            {
                message = $"Error updating total time for series ID '{seriesId}'.";
                _logger.LogError(message, ex);
                return message;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return message;
        }

        /// <inheritdoc/>
        public string UpdateTotalMovies(int seriesId)
        {
            var message = "Updating the total movies for the series was not successful.";
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.UpdateTotalMovies;
                var parameters = SharedDatabaseParameters.IdParameters(seriesId);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    message = $"Total movies for series ID '{seriesId}' updated successfully.";
                    _logger.LogInformation(message);
                    return message;
                }
            }
            catch (Exception ex)
            {
                message = $"Error updating total movies for series ID '{seriesId}'.";
                _logger.LogError(message, ex);
                return message;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return message;
        }

        /// <inheritdoc/>
        public string UpdateWatched(int seriesId)
        {
            var message = "Updating watched for the series was not successful.";
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.UpdateWatched;
                var parameters = SharedDatabaseParameters.IdParameters(seriesId);
                var result = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, query, parameters);

                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    message = $"Watched status for series ID '{seriesId}' updated successfully.";
                    _logger.LogInformation(message);
                    return message;
                }
            }
            catch (Exception ex)
            {
                message = $"Error updating watched status for series ID '{seriesId}'.";
                _logger.LogError(message, ex);
                return message;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return message;
        }

        /// <inheritdoc/>
        public decimal GetTimeLeft(int seriesId)
        {
            try
            {
                _databaseConnectionsHelper.Open();
                var query = MovieSeriesQueries.GetTimeLeft;
                var parameters = SharedDatabaseParameters.IdParameters(seriesId);
                var result = DatabaseCommandsHelper.ExecutesScalar(_databaseConnection, query, parameters);
                var parser = new Parser();
#pragma warning disable CS8604 // Possible null reference argument.
                _ = parser.IsDecimal(result, out var decimalValue);
#pragma warning restore CS8604 // Possible null reference argument.

                _logger.LogInformation("Retrieving time left for movie series was successful.");
                return decimalValue;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching time left for series ID '{seriesId}'.", ex);
                return 0.0M;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <inheritdoc/>
        public override IEnumerable<MovieSeries> GetAll()
        {
            try
            {
                _databaseConnectionsHelper.Open();
                using var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, MovieSeriesQueries.GetAllSeries);
                var seriesList = new List<MovieSeries>();
                while (reader.Read())
                {
                    var movieSeries = new MovieSeries(reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0));
                    seriesList.Add(movieSeries);
                }

                _logger.LogInformation("Retrieving all the movie series was successful.");
                return seriesList;
            }
            catch (Exception ex)
            {
                _logger.LogError("Error fetching all movie series.", ex);
                return [];
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }
    }
}