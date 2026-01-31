using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.ConsoleApp.Providers;
using HorrorTracker.Utilities.Helpers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// Provides management functionality for interacting with The Movie Database (TMDB) API, including operations to
    /// add movies, series, documentaries, and television shows to the database.
    /// </summary>
    /// <remarks>This manager presents an interactive menu for performing various TMDB-related actions, such
    /// as searching for movies or series to add. It is designed to be used in console-based applications and relies on
    /// injected services for logging, user interaction, and system operations.</remarks>
    /// <param name="logger">The logger service used to record informational and error messages during API management operations.</param>
    /// <param name="connectionString">The connection string used to access the underlying database for storing and retrieving movie-related data.</param>
    /// <param name="horroConsole">The console interface used for user interaction and displaying output in the application.</param>
    /// <param name="systemFunctions">The system functions provider used to perform platform-specific operations required by the manager.</param>
    public class MovieDatabaseApiManager(
        ILoggerService logger,
        string connectionString,
        IHorrorConsole horroConsole,
        ISystemFunctions systemFunctions)
        : Manager(connectionString, logger, horroConsole, systemFunctions)
    {
        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerTitles();

                var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
                var decision = themersFactory.SpookyTextStyler.InteractiveMenu("=== TMDB Menu ===", RetrieveMenuOptions());
                var actions = MovieDatabaseApiDecisionActions();

                var decisionProcessor = new DecisionProcessor(new Parser(), Logger, HorrorConsole, SystemFunctions);
                decisionProcessor.Process(decision, actions);
            }
        }

        /// <summary>
        /// Displays a list of upcoming horror films to the console.
        /// </summary>
        /// <remarks>This method retrieves upcoming horror films and outputs them using the configured
        /// console and logging services. It is intended for informational display purposes and does not return any data
        /// to the caller.</remarks>
        public void DisplayUpcomingHorrorFilms()
        {
            var movieProvider = new MovieProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieProvider.UpcomingHorrorFilms();
        }

        /// <summary>
        /// Provides a mapping of decision identifiers to actions for handling various operations in the movie database
        /// API.
        /// </summary>
        /// <remarks>The returned dictionary associates decision codes with actions such as searching for
        /// series or movies, adding documentaries, television shows, or episodes, and exiting the workflow. This
        /// mapping enables dynamic selection and execution of API-related tasks based on user input or program
        /// logic.</remarks>
        /// <returns>A dictionary where each key is an integer representing a decision option, and each value is an action to
        /// execute the corresponding operation.</returns>
        private Dictionary<int, Action> MovieDatabaseApiDecisionActions()
        {
            return new Dictionary<int, Action>()
            {
                { 1, SearchSeriesToAdd },
                { 2, SearchMovieToAdd },
                { 3, AddDocumentary },
                { 4, AddTelevisionShow },
                { 5, AddEpisode },
                { 6, FindSeriesToAdd },
                { 7, () => { IsNotDone = false; Logger.LogInformation("Selected to exit."); } }
            };
        }

        /// <summary>
        /// Initiates the process for searching and adding a movie series to the database based on the user's input.
        /// </summary>
        /// <remarks>This method prompts the user to search for a movie series and delegates the search
        /// operation to the underlying provider. The method is intended to be used as part of a workflow for managing
        /// movie series within the application.</remarks>
        private void SearchSeriesToAdd()
        {
            var decision = InitialUserDecision("----- Add Series to Datebase -----", "Search for a series below to add to the database.");
            var movieSeriesProvider = new MovieSeriesProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieSeriesProvider.SearchForMovieSeries(decision);
        }

        /// <summary>
        /// Initiates the process for searching and adding a movie to the database.
        /// </summary>
        /// <remarks>This method prompts the user to search for a movie and delegates the search operation
        /// to the movie provider. It is intended to be used as part of the workflow for adding new movies to the
        /// database.</remarks>
        private void SearchMovieToAdd()
        {
            var decision = InitialUserDecision("----- Add Movie to Datebase -----", "Search for a movie below to add to the database.");
            var movieProvider = new MovieProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieProvider.SearchMovie(decision);
        }

        /// <summary>
        /// Adds a documentary to the database.
        /// </summary>
        private void AddDocumentary()
        {
            var decision = InitialUserDecision("----- Add Documentary to Datebase -----", "Search for a documentary below to add to the database.");
            if (StringHelper.StringIsNull(decision))
            {
                return;
            }

            // Same as the movies above.
        }

        /// <summary>
        /// Adds a television show to the database.
        /// </summary>
        private void AddTelevisionShow()
        {
            HorrorConsole.Clear();
        }

        /// <summary>
        /// Adds a episode to the database.
        /// </summary>
        private void AddEpisode()
        {
            HorrorConsole.Clear();
        }

        /// <summary>
        /// Prompts the user to select a genre and initiates the process to find and add movie series for the chosen
        /// genre.
        /// </summary>
        /// <remarks>This method displays an interactive menu for genre selection and validates the user's
        /// input. If a valid genre is selected, it delegates the search and addition of movie series to the
        /// corresponding provider. The method provides feedback to the user in case of invalid input.</remarks>
        private void FindSeriesToAdd()
        {
            HorrorConsole.Clear();
            HorrorConsole.SetForegroundColor(ConsoleColor.Red);
            HorrorConsole.MarkupLine("----- Find Collections to Add -----");
            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();

            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            var genreIdSelection = themersFactory.SpookyTextStyler.InteractiveMenu("--- Genre Selection ---", ["27 = Horror", "53 = Thriller", "9648 = Mystery"]);
            var genreIdSelectionNumber = genreIdSelection.Split('=').First().Trim();
            if (!Parser.IsInteger(genreIdSelectionNumber, out var genreInt))
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("The selection was not an integer. Please try again.");
                return;
            }

            var movieSeriesProvider = new MovieSeriesProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieSeriesProvider.FindSeriesToAdd(genreInt);
        }

        /// <summary>
        /// Prompts the user with a styled title and message, then reads the user's initial decision from the console
        /// input.
        /// </summary>
        /// <remarks>The prompt uses themed console styling to enhance user engagement. The returned value
        /// is not validated and may be empty or null depending on user input and console state.</remarks>
        /// <param name="title">The title text to display at the top of the prompt. This is shown in a highlighted style to draw attention.</param>
        /// <param name="prompt">The message or question presented to the user, describing the decision to be made.</param>
        /// <returns>A string containing the user's input, or null if the input stream is closed.</returns>
        private string? InitialUserDecision(string title, string prompt)
        {
            HorrorConsole.Clear();
            HorrorConsole.SetForegroundColor(ConsoleColor.Red);
            HorrorConsole.MarkupLine(title);
            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();

            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.DarkGray, 25, prompt);
            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();
            HorrorConsole.Write(">> ");
            return HorrorConsole.ReadLine();
        }

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "The Movie Database API";

        /// <inheritdoc/>
        protected override List<string> RetrieveMenuOptions() => 
            ["1. Search Series to Add",
            "2. Serach Movie to Add",
            "3. Add Documentary",
            "4. Add TV Show",
            "5. Add Episode",
            "6. Find Series to Add",
            "7. Exit"];
    }
}