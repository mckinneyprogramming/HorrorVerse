using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Utilities.Logging.Interfaces;
using Npgsql;

namespace HorrorTracker.WinFormsApp.Forms
{
    /// <summary>
    /// The main form for the Horror Tracker application.
    /// </summary>
    public partial class MainForm : Form
    {
        private readonly string _connectionString;
        private readonly ILoggerService _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="MainForm"/> class.
        /// </summary>
        /// <param name="connectionString">The connection string.</param>
        /// <param name="logger">The logger service.</param>
        public MainForm(string connectionString, ILoggerService logger)
        {
            _connectionString = connectionString;
            _logger = logger;
            InitializeComponent();
            SetupForm();
            TestDatabaseConnection();
            LoadOverallStats();
        }

        /// <summary>
        /// Sets up the form initial state.
        /// </summary>
        private void SetupForm()
        {
            this.Text = "Horror Tracker - Home";
            this.Size = new System.Drawing.Size(900, 700);
            this.StartPosition = FormStartPosition.CenterScreen;
        }

        /// <summary>
        /// Tests the database connection and displays detailed error information if it fails.
        /// </summary>
        private void TestDatabaseConnection()
        {
            try
            {
                _logger.LogInformation("Testing database connection...");
                using var testConnection = new NpgsqlConnection(_connectionString);
                testConnection.Open();
                _logger.LogInformation("Database connection successful!");
                testConnection.Close();
            }
            catch (NpgsqlException npgsqlEx)
            {
                _logger.LogError($"PostgreSQL connection failed: {npgsqlEx.Message}", npgsqlEx);
                
                string errorDetails = npgsqlEx.InnerException != null 
                    ? $"\n\nDetails: {npgsqlEx.InnerException.Message}" 
                    : "";
                
                string troubleshooting = @"
                    Troubleshooting steps:
                    1. Verify PostgreSQL is running
                    2. Check the connection string in App.config
                    3. Verify database 'HorrorTracker' exists
                    4. Confirm username and password are correct
                    5. Check if port 5432 is correct";

                MessageBox.Show(
                    $"Failed to connect to PostgreSQL database.\n\nError: {npgsqlEx.Message}{errorDetails}{troubleshooting}",
                    "Database Connection Failed",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Unexpected connection error: {ex.Message}", ex);
                MessageBox.Show(
                    $"Unexpected error testing database connection.\n\nError: {ex.Message}",
                    "Connection Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        /// <summary>
        /// Loads the overall statistics from the database.
        /// </summary>
        private void LoadOverallStats()
        {
            try
            {
                _logger.LogInformation("Loading overall statistics...");
                
                var connection = new DatabaseConnection(_connectionString);
                var overallRepository = new OverallRepository(connection, _logger);

                var totalTime = overallRepository.GetOverallTime() / 60;
                var timeLeft = overallRepository.GetOverallTimeLeft() / 60;

                lblTotalTime.Text = $"{totalTime:F2} hours";
                lblTimeLeft.Text = $"{timeLeft:F2} hours";
                lblWatched.Text = $"{(totalTime - timeLeft):F2} hours";
                
                _logger.LogInformation("Overall statistics loaded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to load overall stats: {ex.Message}", ex);
                lblTotalTime.Text = "N/A";
                lblTimeLeft.Text = "N/A";
                lblWatched.Text = "N/A";
            }
        }
    }
}