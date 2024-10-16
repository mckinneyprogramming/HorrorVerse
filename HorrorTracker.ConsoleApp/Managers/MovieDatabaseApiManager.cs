using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Providers;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="MovieDatabaseApiManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
#pragma warning disable CS8604 // Possible null reference argument.
    public class MovieDatabaseApiManager : Manager
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        private readonly string? _connectionString;

        /// <summary>
        /// The parser.
        /// </summary>
        private readonly Parser _parser;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieDatabaseApiManager"/> class.
        /// </summary>
        /// <param name="logger">The logger.</param>
        public MovieDatabaseApiManager(LoggerService logger, string? connectionString)
            : base(logger)
        {
            _connectionString = connectionString;
            _parser = new Parser();
        }

        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerMenus();

                var decision = Console.ReadLine();
                var actions = MovieDatabaseApiDecisionActions();

                ConsoleHelper.ProcessDecision(decision, _logger, actions);
            }
        }

        /// <summary>
        /// Displays the upcoming movies.
        /// </summary>
        public static void DisplayUpcomingHorrorFilms()
        {
            MovieProvider.UpcomingHorroFilms();
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
                { 7, () => { IsNotDone = false; _logger.LogInformation("Selected to exit."); } }
            };
        }

        /// <summary>
        /// Adds a series and its movies to the database.
        /// </summary>
        private void SearchSeriesToAdd()
        {
            var decision = InitialUserDecision("----- Add Series to Datebase -----", "Search for a series below to add to the database.");

            var movieSeriesProvider = new MovieSeriesProvider(_connectionString, _parser, _logger);
            movieSeriesProvider.SearchForMovieSeries(decision);
        }

        /// <summary>
        /// Adds a movie to the database.
        /// </summary>
        private void SearchMovieToAdd()
        {
            var decision = InitialUserDecision("----- Add Movie to Datebase -----", "Search for a movie below to add to the database.");
            var movieProvider = new MovieProvider(_connectionString, _parser, _logger);
            movieProvider.SearchMovie(decision);
        }

        /// <summary>
        /// Adds a documentary to the database.
        /// </summary>
        private void AddDocumentary()
        {
            var decision = InitialUserDecision("----- Add Documentary to Datebase -----", "Search for a documentary below to add to the database.");
            if (_parser.StringIsNull(decision))
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
            Console.Clear();
        }

        /// <summary>
        /// Adds a episode to the database.
        /// </summary>
        private void AddEpisode()
        {
            Console.Clear();
        }

        /// <summary>
        /// Finds a series to add to the database.
        /// </summary>
        private void FindSeriesToAdd()
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("----- Find Collections to Add -----");
            Console.WriteLine();
            Console.ResetColor();
            Console.WriteLine("Select a Genre Id:");
            Console.WriteLine(
                "Horror - 27\n" +
                "Thriller - 53\n" +
                "Mystery - 9648");
            Console.Write(">> ");
            var genreId = Console.ReadLine();
            if (!_parser.IsInteger(genreId, out var genreInt))
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The selection was not an integer. Please try again.");
                return;
            }

            var movieSeriesProvider = new MovieSeriesProvider(_connectionString, _parser, _logger);
            movieSeriesProvider.FindSeriesToAdd(genreInt);
        }

        /// <summary>
        /// Retrieves the initial user decision to search the database.
        /// </summary>
        /// <param name="title">The console title.</param>
        /// <param name="prompt">The console prompt.</param>
        private static string? InitialUserDecision(string title, string prompt)
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine(title);
            Console.WriteLine();
            Console.ResetColor();

            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage(prompt);
            Console.ResetColor();
            Console.WriteLine();
            Console.Write(">> ");
            return Console.ReadLine();
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
#pragma warning restore CS8604 // Possible null reference argument.
}