using HorrorTracker.Utilities.Logging.Interfaces;

namespace HorrorTracker.WinFormsApp.Forms
{
    /// <summary>
    /// The series management form for the Horror Tracker application.
    /// </summary>
    public partial class SeriesForm : Form
    {
        private readonly string _connectionString;
        private readonly ILoggerService _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="SeriesForm"/> class.
        /// </summary>
        /// <param name="connectionString">The connection string.</param>
        /// <param name="logger">The logger service.</param>
        public SeriesForm(string connectionString, ILoggerService logger)
        {
            _connectionString = connectionString;
            _logger = logger;
            InitializeComponent();
            SetupForm();
        }

        /// <summary>
        /// Sets up the form initial state.
        /// </summary>
        private void SetupForm()
        {
            this.Text = "Horror Tracker - Series Management";
            this.Size = new System.Drawing.Size(900, 700);
            this.StartPosition = FormStartPosition.CenterScreen;
        }

        /// <summary>
        /// Handles the Add Series button click event.
        /// </summary>
        private void BtnAddSeries_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("Add Series button clicked.");
            // TODO: Open Add Series form
            MessageBox.Show("Add Series functionality coming soon!", "Add Series", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        /// <summary>
        /// Handles the View Series button click event.
        /// </summary>
        private void BtnViewSeries_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("View Series button clicked.");
            // TODO: Open View Series form
            MessageBox.Show("View Series functionality coming soon!", "View Series", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        /// <summary>
        /// Handles the Update Series button click event.
        /// </summary>
        private void BtnUpdateSeries_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("Update Series button clicked.");
            // TODO: Open Update Series form
            MessageBox.Show("Update Series functionality coming soon!", "Update Series", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        /// <summary>
        /// Handles the Back button click event.
        /// </summary>
        private void BtnBack_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("Returning to main form.");
            this.Close();
        }
    }
}