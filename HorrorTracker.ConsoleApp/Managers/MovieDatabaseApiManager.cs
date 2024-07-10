using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.DataHelpers;
using HorrorTracker.Data.Performers;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="MovieDatabaseApiManager"/> class.
    /// </summary>
    /// <seealso cref="Manager"/>
    public class MovieDatabaseApiManager : Manager
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        private readonly string _connectionString;

        /// <summary>
        /// IsNotDone indicator.
        /// </summary>
        private bool IsNotDone = true;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieDatabaseApiManager"/> class.
        /// </summary>
        /// <param name="logger">The logger.</param>
        public MovieDatabaseApiManager(LoggerService logger, string connectionString)
            : base(logger)
        {
            _connectionString = connectionString;
        }

        /// <inheritdoc/>
        public override void Manage()
        {
            while (IsNotDone)
            {
                DisplayManagerMenus();

                var decision = ConsoleHelper.GetUserInput();
                var actualNumber = ConsoleHelper.ParseNumberDecision(_logger, decision);
                var actions = MovieDatabaseApiDecisionActions();

                ConsoleHelper.ProcessDecision(actualNumber, _logger, actions);
            }
        }

        /// <summary>
        /// Retrieves the dictionary of actions.
        /// </summary>
        /// <returns>The dictionary of actions.</returns>
        private Dictionary<int, Action> MovieDatabaseApiDecisionActions()
        {
            return new Dictionary<int, Action>()
            {
                { 1, AddSeries },
                { 2, AddMovie },
                { 3, AddDocumentary },
                { 4, AddTelevisionShow },
                { 5, AddEpisode },
                { 6, () => { IsNotDone = false; _logger.LogInformation("Selected to exit."); } }
            };
        }

        /// <summary>
        /// Adds a series and its movies to the database.
        /// </summary>
        private void AddSeries()
        {
            var decision = InitialUserDecision("----- Add Series to Datebase -----", "Search for a series below to add to the database.");
            if (!ConsoleHelper.UserInputIsValid(decision))
            {
                return;
            }

            var movieDatabaseService = CreateMovieDatabaseService();
            var result = movieDatabaseService.SearchCollection($"{decision} Collection").Result;

            SeriesHelper.DisplaySearchResults(result);

            var collectionId = SeriesHelper.PromptForSeriesId();
            if (collectionId == 0)
            {
                return;
            }

            var collectionInformation = movieDatabaseService.GetCollection(collectionId).Result;
            var filmsInSeries = SeriesHelper.FetchFilmsInSeries(movieDatabaseService, collectionInformation.Parts);
            var series = SeriesHelper.CreateMovieSeries(collectionInformation, filmsInSeries);

            var databaseConnection = new DatabaseConnection(_connectionString);
            var movieSeriesRepository = new MovieSeriesRepository(databaseConnection, _logger);

            if (!Inserter.MovieSeriesAddedSuccessfully(movieSeriesRepository, series))
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The movie series you are trying to add alreday exists in the database or an error occurred. Please try a different series.");
                return;
            }

            ConsoleHelper.DatabaseSuccessfulMessage($"The movie series '{series.Title}' was added successfully.");

            var newSeries = movieSeriesRepository.GetMovieSeriesByName(series.Title);
#pragma warning disable CS8602 // Dereference of a possibly null reference.
            SeriesHelper.AddFilmsInSeriesToDatabase(filmsInSeries, databaseConnection, newSeries.Id, _logger);
#pragma warning restore CS8602 // Dereference of a possibly null reference.

            ConsoleHelper.DatabaseSuccessfulMessage($"Movie series: {series.Title} was added successfully as well as the movies in the series.");
        }

        /// <summary>
        /// Adds a movie to the database.
        /// </summary>
        private void AddMovie()
        {
            var decision = InitialUserDecision("----- Add Movie to Datebase -----", "Search for a movie below to add to the database.");
            if (!ConsoleHelper.UserInputIsValid(decision))
            {
                return;
            }

            var movieDatabaseService = CreateMovieDatabaseService();
        }

        /// <summary>
        /// Adds a documentary to the database.
        /// </summary>
        private void AddDocumentary()
        {
            Console.Clear();
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
        /// Retrieves the initial user decision to search the database.
        /// </summary>
        /// <param name="title">The console title.</param>
        /// <param name="prompt">The console prompt.</param>
        private static string InitialUserDecision(string title, string prompt)
        {
            Console.Clear();
            ConsoleHelper.GroupedConsole(ConsoleColor.Red, title);

            ConsoleHelper.TypeStringPromptUser(prompt);
#pragma warning disable CS8603 // Possible null reference return.
            return ConsoleHelper.GetUserInput();
#pragma warning restore CS8603 // Possible null reference return.
        }

        /// <summary>
        /// Creates TMDB API service.
        /// </summary>
        /// <returns>The movie database service.</returns>
        private static MovieDatabaseService CreateMovieDatabaseService()
        {
            var movieDatabaseConfig = new MovieDatabaseConfig();
            var movieDatabaseClientWrapper = new TMDbClientWrapper(movieDatabaseConfig.GetApiKey());
            return new MovieDatabaseService(movieDatabaseClientWrapper);
        }

        /// <inheritdoc/>
        protected override string RetrieveTitle() => "The Movie Database API";

        /// <inheritdoc/>
        protected override string RetrieveMenuOptions() => 
            "1. Add Series\n" +
            "2. Add Movie\n" +
            "3. Add Documentary\n" +
            "4. Add TV Show\n" +
            "5. Add Episode\n" +
            "6. Exit";
    }
}