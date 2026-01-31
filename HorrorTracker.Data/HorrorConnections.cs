using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Constants.Queries;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.PostgreHelpers.Interfaces;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.Data
{
    /// <summary>
    /// Provides access to database connection management, logging, and repository creation for the HorrorTracker
    /// application.
    /// </summary>
    /// <remarks>This class centralizes database connectivity and repository instantiation for movies, series,
    /// documentaries, shows, and episodes. It ensures that connections are managed and logging is performed for key
    /// operations. All repository instances returned are configured with the provided database connection and
    /// logger.</remarks>
    /// <param name="databaseConnection">The database connection used for executing queries and managing data operations.</param>
    /// <param name="logger">The logger service used to record informational, warning, and error messages during database operations.</param>
    public class HorrorConnections(IDatabaseConnection databaseConnection, ILoggerService logger)
    {
        private readonly IDatabaseConnection _databaseConnection = databaseConnection;
        private readonly ILoggerService _logger = logger;
        private readonly DatabaseConnectionsHelper _databaseConnectionsHelper = new(databaseConnection);

        /// <summary>
        /// Attempts to establish a connection to the PostgreSQL server and verifies the existence of the HorrorTracker
        /// database.
        /// </summary>
        /// <remarks>This method logs informational or warning messages based on the outcome of the
        /// connection and database existence check. If an error occurs during the connection process, the error message
        /// is included in the returned string and an error is logged. The connection is closed after the operation
        /// completes, regardless of the outcome.</remarks>
        /// <returns>A string indicating the result of the connection attempt. Returns "Connection successful! Database exists on
        /// the server." if the connection and database check succeed; "Connection is successful, but database does not
        /// exist on the server." if the connection succeeds but the database is not found; or an error message if the
        /// connection fails.</returns>
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
        /// Creates the required database tables for movies, series, documentaries, shows, and episodes if they do not
        /// already exist.
        /// </summary>
        /// <remarks>This method attempts to create all necessary tables in the database. If any table
        /// creation fails, the method returns 0 and logs the error. The method opens and closes the database connection
        /// automatically.</remarks>
        /// <returns>1 if all tables are created successfully or already exist; otherwise, 0.</returns>
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
                List<int> results =
                [
                    createdMovieSeriesSuccessfully,
                    createdMovieSuccessfully,
                    createdDocumentarySuccessfully,
                    createdShowSuccessfully,
                    createdEpisodeSuccessfully
                ];

                var allTablesCreatedSuccessfully = AllTablesCreatedSuccessfully([.. results]);
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
        /// Retrieves an instance of the overall repository for accessing aggregated data and operations.
        /// </summary>
        /// <returns>An <see cref="OverallRepository"/> object initialized with the current database connection and logger.</returns>
        public OverallRepository RetrieveOverallRepository()
        {
            return new OverallRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Retrieves a repository instance for accessing and managing movie series data.
        /// </summary>
        /// <returns>A <see cref="MovieSeriesRepository"/> object that provides methods for querying and updating movie series
        /// information.</returns>
        public MovieSeriesRepository RetrieveMovieSeriesRepository()
        {
            return new MovieSeriesRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Retrieves a new instance of the movie repository configured with the current database connection and logger.
        /// </summary>
        /// <returns>A <see cref="MovieRepository"/> instance that provides access to movie data operations.</returns>
        public MovieRepository RetrieveMovieRepository()
        {
            return new MovieRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Retrieves an instance of the documentary repository for accessing documentary data.
        /// </summary>
        /// <returns>A <see cref="DocumentaryRepository"/> object configured to interact with the current database connection and
        /// logger.</returns>
        public DocumentaryRepository RetrieveDocumentaryRepository()
        {
            return new DocumentaryRepository(_databaseConnection, _logger);
        }

        /// <summary>
        /// Determines whether all tables were created successfully based on the specified results array.
        /// </summary>
        /// <remarks>If the array is empty, the method returns true. Ensure that the array contains the
        /// results of all relevant table creation operations for accurate evaluation.</remarks>
        /// <param name="resultsArray">An array of integers representing the result of each table creation operation. Each element should be 1 to
        /// indicate success.</param>
        /// <returns>true if every element in the array equals 1; otherwise, false.</returns>
        private static bool AllTablesCreatedSuccessfully(int[] resultsArray) => Array.TrueForAll(resultsArray, res => res == 1);
    }
}