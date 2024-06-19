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
        public object? AddMovieSeries(MovieSeries series)
        {
            object? result = null;
            try
            {
                _databaseConnectionsHelper.Open();

                var addSeriesCommandText = MovieSeriesQueries.InsertSeries;
                var parameters = MovieSeriesDatabaseParameters.InsertMovieSeriesParameters(series);

                result = DatabaseCommandsHelper.ExecutesScalar(_databaseConnection, addSeriesCommandText, parameters);
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
                var parameters = MovieSeriesDatabaseParameters.GetMovieSeriesParameters(seriesName);

                using (var reader = DatabaseCommandsHelper.ExecutesReader(_databaseConnection, commandText, parameters))
                {
                    if (reader.Read())
                    {
                        movieSeries = new MovieSeries(reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetInt32(0));
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
    }
}