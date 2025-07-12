using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.ConsoleApp.Providers;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="MovieDatabaseApiManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
    /// <remarks>
    /// Initializes a new instance of the <see cref="MovieDatabaseApiManager"/> class.
    /// </remarks>
    /// <param name="logger">The logger.</param>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="horroConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class MovieDatabaseApiManager(LoggerService logger, string? connectionString, IHorrorConsole horroConsole, ISystemFunctions systemFunctions)
        : Manager(connectionString, logger, horroConsole, systemFunctions)
    {
        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerMenus();

                var decision = HorrorConsole.ReadLine();
                var actions = MovieDatabaseApiDecisionActions();

                ConsoleHelper.ProcessDecision(decision, Logger, actions);
            }
        }

        /// <summary>
        /// Displays the upcoming movies.
        /// </summary>
        public void DisplayUpcomingHorrorFilms()
        {
            var movieProvider = new MovieProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieProvider.UpcomingHorrorFilms();
        }

        /// <summary>
        /// Retrieves the dictionary of actions.
        /// </summary>
        /// <returns>The dictionary of actions.</returns>
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
        /// Adds a series and its movies to the database.
        /// </summary>
        private void SearchSeriesToAdd()
        {
            var decision = InitialUserDecision("----- Add Series to Datebase -----", "Search for a series below to add to the database.");
            var movieSeriesProvider = new MovieSeriesProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieSeriesProvider.SearchForMovieSeries(decision);
        }

        /// <summary>
        /// Adds a movie to the database.
        /// </summary>
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
            if (Parser.StringIsNull(decision))
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
        /// Finds a series to add to the database.
        /// </summary>
        private void FindSeriesToAdd()
        {
            HorrorConsole.Clear();
            HorrorConsole.SetForegroundColor(ConsoleColor.Red);
            HorrorConsole.MarkupLine("----- Find Collections to Add -----");
            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();
            HorrorConsole.MarkupLine("Select a Genre Id:");
            HorrorConsole.MarkupLine(
                "Horror - 27\n" +
                "Thriller - 53\n" +
                "Mystery - 9648");
            HorrorConsole.Write(">> ");
            var genreId = HorrorConsole.ReadLine();
            if (!Parser.IsInteger(genreId, out var genreInt))
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("The selection was not an integer. Please try again.");
                return;
            }

            var movieSeriesProvider = new MovieSeriesProvider(ConnectionString, Logger, HorrorConsole, SystemFunctions);
            movieSeriesProvider.FindSeriesToAdd(genreInt);
        }

        /// <summary>
        /// Retrieves the initial user decision to search the database.
        /// </summary>
        /// <param name="title">The console title.</param>
        /// <param name="prompt">The console prompt.</param>
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
        protected override string RetrieveMenuOptions() => 
            "1. Search Series to Add\n" +
            "2. Serach Movie to Add\n" +
            "3. Add Documentary\n" +
            "4. Add TV Show\n" +
            "5. Add Episode\n" +
            "6. Find Series to Add\n" +
            "7. Exit";
    }
}