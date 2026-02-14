using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging.Interfaces;
using TMDbLib.Objects.Search;

namespace HorrorTracker.WinFormsApp.Forms
{
    /// <summary>
    /// The series management form for the Horror Tracker application.
    /// </summary>
    public partial class SeriesForm : BaseHorrorForm
    {
        private readonly string _connectionString;
        private readonly ILoggerService _logger;
        private MovieDatabaseService? _movieDatabaseService;
        private List<SearchCollection>? _searchResults;

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
            InitializeTMDbService();
        }

        /// <summary>
        /// Sets up the form initial state.
        /// </summary>
        private void SetupForm()
        {
            this.Text = "Horror Tracker - Series Management";
            this.Size = new System.Drawing.Size(1000, 750);
            this.StartPosition = FormStartPosition.CenterScreen;
            
            // Set hand cursor for all buttons
            SetHandCursorForButtons();
        }

        /// <summary>
        /// Initializes the TMDb service.
        /// </summary>
        private void InitializeTMDbService()
        {
            try
            {
                var apiKey = Environment.GetEnvironmentVariable("TMDBKey");
                if (string.IsNullOrWhiteSpace(apiKey))
                {
                    _logger.LogWarning("TMDb API key not found in environment variables.");
                    return;
                }

                var tmdbClient = new TMDbClientWrapper(apiKey);
                _movieDatabaseService = new MovieDatabaseService(tmdbClient);
                _logger.LogInformation("TMDb service initialized successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to initialize TMDb service: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Handles the Search button click event.
        /// </summary>
        private async void BtnSearch_Click(object sender, EventArgs e)
        {
            var searchTerm = txtSearch.Text.Trim();
            
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                MessageBox.Show("Please enter a search term.", "Search Series", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (_movieDatabaseService == null)
            {
                MessageBox.Show("TMDb service is not available. Please check your API key configuration.", "Service Unavailable", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            try
            {
                _logger.LogInformation($"Searching TMDb for series: {searchTerm}");
                btnSearch.Enabled = false;
                btnSearch.Text = "Searching...";
                lstSearchResults.Items.Clear();
                txtDescription.Clear();

                // Search only with "Collection" appended to get actual collections
                var searchQuery = searchTerm.Contains("collection", StringComparison.OrdinalIgnoreCase) 
                    ? searchTerm 
                    : $"{searchTerm} Collection";

                var results = await _movieDatabaseService.SearchCollection(searchQuery);

                // Filter to only include results that:
                // 1. Contain the original search term in the name (case-insensitive)
                // 2. Are actual collections (usually have "Collection" in the name or multiple parts)
                _searchResults = results.Results
                    .Where(c => c.Name != null && 
                               c.Name.Contains(searchTerm, StringComparison.OrdinalIgnoreCase))
                    .OrderBy(c => c.Name)
                    .ToList();

                if (_searchResults.Count == 0)
                {
                    lstSearchResults.Items.Add("No collections found.");
                    _logger.LogInformation($"No collections found for search term: {searchTerm}");
                    
                    MessageBox.Show(
                        $"No collections found for '{searchTerm}'.\n\nTry:\n- Different search terms\n- Checking spelling\n- Searching without 'Collection' suffix",
                        "No Results",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
                else
                {
                    foreach (var collection in _searchResults)
                    {
                        lstSearchResults.Items.Add($"{collection.Name}");
                    }
                    _logger.LogInformation($"Found {_searchResults.Count} collection(s) for search term: {searchTerm}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error searching TMDb: {ex.Message}", ex);
                MessageBox.Show($"Failed to search TMDb.\n\nError: {ex.Message}", "Search Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnSearch.Enabled = true;
                btnSearch.Text = "🔍 Search";
            }
        }

        /// <summary>
        /// Handles the selection change in the search results list.
        /// </summary>
        private async void LstSearchResults_SelectedIndexChanged(object sender, EventArgs e)
        {
            if (lstSearchResults.SelectedIndex < 0 || _searchResults == null || _movieDatabaseService == null)
            {
                txtDescription.Clear();
                txtDescription.Text = "Select a collection to view its description.";
                return;
            }

            try
            {
                var selectedCollection = _searchResults[lstSearchResults.SelectedIndex];
                
                // Show loading message
                txtDescription.Text = "Loading description...";
                
                // Get full collection details to retrieve the overview
                var fullCollection = await _movieDatabaseService.GetCollection(selectedCollection.Id);
                
                // Build description with collection details
                var description = $"Collection: {fullCollection.Name}\n";
                description += $"Number of Movies: {fullCollection.Parts?.Count ?? 0}\n\n";
                
                if (!string.IsNullOrWhiteSpace(fullCollection.Overview))
                {
                    description += $"Overview:\n{fullCollection.Overview}";
                }
                else
                {
                    description += "No description available for this collection.";
                }
                
                // Add movie list if available
                if (fullCollection.Parts != null && fullCollection.Parts.Count > 0)
                {
                    description += "\n\nMovies in Collection:\n";
                    foreach (var movie in fullCollection.Parts.OrderBy(m => m.ReleaseDate))
                    {
                        var year = movie.ReleaseDate?.Year.ToString() ?? "Unknown";
                        description += $"• {movie.Title} ({year})\n";
                    }
                }
                
                txtDescription.Text = description;
                
                _logger.LogInformation($"Loaded details for: {selectedCollection.Name}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error loading collection description: {ex.Message}", ex);
                txtDescription.Text = "Error loading description.";
            }
        }

        /// <summary>
        /// Handles the Add Series button click event.
        /// </summary>
        private void BtnAddSeries_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("Add Series button clicked.");
            // TODO: Open Add Series form
            MessageBox.Show("Add Series form coming soon!", "Add Series", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        /// <summary>
        /// Handles the View Series button click event.
        /// </summary>
        private void BtnViewSeries_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("View Series button clicked.");
            // TODO: Open View Series form
            MessageBox.Show("View Series form coming soon!", "View Series", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        /// <summary>
        /// Handles the Update Series button click event.
        /// </summary>
        private void BtnUpdateSeries_Click(object sender, EventArgs e)
        {
            _logger.LogInformation("Update Series button clicked.");
            // TODO: Open Update Series form
            MessageBox.Show("Update Series form coming soon!", "Update Series", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        /// <summary>
        /// Handles the Add Selected Series button click event.
        /// </summary>
        private async void BtnAddSelected_Click(object sender, EventArgs e)
        {
            if (lstSearchResults.SelectedIndex < 0)
            {
                MessageBox.Show("Please select a series from the search results.", "No Selection", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (_searchResults == null || _movieDatabaseService == null)
            {
                return;
            }

            try
            {
                var selectedCollection = _searchResults[lstSearchResults.SelectedIndex];
                _logger.LogInformation($"Adding series: {selectedCollection.Name}");
                
                btnAddSelected.Enabled = false;
                btnAddSelected.Text = "Adding...";

                // Get full collection details
                var fullCollection = await _movieDatabaseService.GetCollection(selectedCollection.Id);
                
                // TODO: Add series and movies to database
                var movieList = string.Join("\n", fullCollection.Parts.OrderBy(m => m.ReleaseDate).Select(m => $"• {m.Title} ({m.ReleaseDate?.Year ?? 0})"));
                
                MessageBox.Show(
                    $"Collection: {fullCollection.Name}\n" +
                    $"Total Movies: {fullCollection.Parts.Count}\n\n" +
                    $"Movies:\n{movieList}\n\n" +
                    $"Ready to add to database!\n(Full implementation coming soon)",
                    "Collection Details",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error adding series: {ex.Message}", ex);
                MessageBox.Show($"Failed to add series.\n\nError: {ex.Message}", "Add Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnAddSelected.Enabled = true;
                btnAddSelected.Text = "➕ Add Selected";
            }
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