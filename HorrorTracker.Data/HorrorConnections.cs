using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.Repositories.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data
{
    /// <summary>
    /// The <see cref="HorrorConnections"/> class.
    /// </summary>
    public class HorrorConnections
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
        /// Initializes a new instance of the <see cref="HorrorConnections"/> class.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="logger">The logger.</param>
        public HorrorConnections(IDatabaseConnection databaseConnection, ILoggerService logger)
        {
            _databaseConnection = databaseConnection;
            _logger = logger;
            _databaseConnectionsHelper = new DatabaseConnectionsHelper(databaseConnection, logger);
        }

        /// <summary>
        /// Makes a connection to the database.
        /// </summary>
        /// <returns>A connection message.</returns>
        public string Connect()
        {
            try
            {
                _databaseConnectionsHelper.Open();

                var commandText = OverallQueries.HorrorTrackerDatabaseConnection;
                var parameters = OverallDatabaseParameters.DatabaseConnection();

                var result = DatabaseCommandsHelper.ExecutesScalar(_databaseConnection, commandText, parameters);
                if (DatabaseCommandsHelper.IsSuccessfulResult(result))
                {
                    _logger.LogInformation("The connection to the server was successful and the database exists.");
                    return "Connection successful! Database exists on the server.";
                }
                else
                {
                    _logger.LogWarning("The connection to the server was successful, but the HorrorTracker database was not found.");
                    return "Connection is successful, but database does not exist on the server.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("The connection to the Postgre server failed.", ex);
                return $"Connection failed: {ex.Message}";
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }
        }

        /// <summary>
        /// Creates the tables for the database.
        /// </summary>
        /// <returns>The status.</returns>
        public int CreateTables()
        {
            int result = 0;
            try
            {
                _databaseConnectionsHelper.Open();

                var createdMovieSeriesSuccessfully = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, OverallQueries.CreateMovieSeriesTable);
                var createdMovieSuccessfully = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, OverallQueries.CreateMovieTable);
                var createdDocumentarySuccessfully = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, OverallQueries.CreateDocumentaryTable);
                var createdShowSuccessfully = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, OverallQueries.CreateShowTable);
                var createdEpisodeSuccessfully = DatabaseCommandsHelper.ExecuteNonQuery(_databaseConnection, OverallQueries.CreateEpisodeTable);
                var results = new[]
                {
                    createdMovieSeriesSuccessfully,
                    createdMovieSuccessfully,
                    createdDocumentarySuccessfully,
                    createdShowSuccessfully,
                    createdEpisodeSuccessfully
                };

                var allTablesCreatedSuccessfully = AllTablesCreatedSuccessfully(results);
                if (DatabaseCommandsHelper.IsSuccessfulResult(allTablesCreatedSuccessfully))
                {
                    result = 1;
                    _logger.LogInformation("All tables were built successfully if they weren't already created.");
                    return result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Creating tables in the database failed.", ex);
                return result;
            }
            finally
            {
                _databaseConnectionsHelper.Close();
            }

            return result;
        }

        /// <summary>
        /// Retrievs the overall repository.
        /// </summary>
        /// <returns>The overall repository.</returns>
        public OverallRepository RetrieveOverallRepository()
        {
            return new OverallRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Retrieves the movie series repository.
        /// </summary>
        /// <returns>The movie series repository.</returns>
        public MovieSeriesRepository RetrieveMovieSeriesRepository()
        {
            return new MovieSeriesRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Retrieves the movie repository.
        /// </summary>
        /// <returns>The movie repository.</returns>
        public MovieRepository RetrieveMovieRepository()
        {
            return new MovieRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Checks that all the results for the table creations are successful.
        /// </summary>
        /// <param name="resultsArray">The results.</param>
        /// <returns>True if all are successful; false otherwise.</returns>
        private static bool AllTablesCreatedSuccessfully(int[] resultsArray) => Array.TrueForAll(resultsArray, res => res == 1);
    }
}