using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Managers.Interfaces;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Managers
{
    /// <summary>
    /// The <see cref="MovieDatabaseApiManager"/> class.
    /// </summary>
    /// <seealso cref="IManager"/>
    public class MovieDatabaseApiManager : IManager
    {
        /// <summary>
        /// The logger service.
        /// </summary>
        private readonly LoggerService _logger;

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
        {
            _logger = logger;
            _connectionString = connectionString;
        }

        /// <inheritdoc/>
        public void Manage()
        {
            while (IsNotDone)
            {
                Console.Title = ConsoleTitles.RetrieveTitle("Movie Database API");

                Console.Clear();
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("========== The Movie Database API ==========");

                Console.ForegroundColor = ConsoleColor.DarkGray;
                ConsoleHelper.TypeMessage("Choose an option below to get started adding items to your database!");
                Console.ResetColor();
                ConsoleHelper.NewLine();

                Console.WriteLine(
                    "1. Add Series\n" +
                    "2. Add Movie\n" +
                    "3. Add Documentary\n" +
                    "4. Add TV Show\n" +
                    "5. Add Episode\n" +
                    "6. Exit");
                Console.Write(">> ");

                _logger.LogInformation("TMDB API Menu displayed.");

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
            Console.Clear();
            ConsoleHelper.GroupedConsole(ConsoleColor.Red, "----- Add Series to Datebase -----");

            PromptUser("Search for a series below to add to the database.");
            var decision = ConsoleHelper.GetUserInput();

            if (string.IsNullOrEmpty(decision))
            {
                return;
            }

            var movieDatabaseConfig = new MovieDatabaseConfig();
            var movieDatabaseClientWrapper = new TMDbClientWrapper(movieDatabaseConfig.GetApiKey());
            var movieDatabaseService = new MovieDatabaseService(movieDatabaseClientWrapper);
            var result = movieDatabaseService.SearchCollection($"{decision} Collection").Result;

            ConsoleHelper.NewLine();
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("The following series were found based on your input:");

            Console.ForegroundColor = ConsoleColor.Magenta;
            foreach (var collection in result.Results)
            {
                Console.WriteLine($"- {collection.Name}; Id: {collection.Id}\n" +
                    $"  - {collection.Overview}");
            }

            PromptUser("Choose the series id above to add the series information to the database as well as its associated movies.");
            
            var collectionIdSelection = ConsoleHelper.GetUserInput();
            var parser = new Parser();
            var collectionIdSelectionIsInteger = parser.IsInteger(collectionIdSelection, out var collectionId);
            if (string.IsNullOrEmpty(collectionIdSelection) || !collectionIdSelectionIsInteger)
            {
                return;
            }

            var collectionInformation = movieDatabaseService.GetCollection(collectionId).Result;
            var filmsInSeries = new List<TMDbLib.Objects.Movies.Movie>();
            foreach (var parts in collectionInformation.Parts)
            {
                var film = movieDatabaseService.GetMovie(parts.Id).Result;
                filmsInSeries.Add(film);
            }

            var totalTimeOfFims = Convert.ToInt32(filmsInSeries.Sum(film => film.Runtime));
            var seriesName = collectionInformation.Name.Replace("Collection", string.Empty).Trim();
            var series = new MovieSeries(seriesName, totalTimeOfFims, collectionInformation.Parts.Count, false);

            var databaseConnection = new DatabaseConnection(_connectionString);
            var movieSeriesRepository = new MovieSeriesRepository(databaseConnection, _logger);

            var movieSeriesAlreadyExists = movieSeriesRepository.GetMovieSeriesByName(series.Title);
            if (movieSeriesAlreadyExists != null)
            {
                _logger.LogWarning("User tried adding a movie series that already exists in the database.");
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The movie series you are trying to add alreday exists in the database. Please try a different series.");
                return;
            }

            var success = movieSeriesRepository.AddMovieSeries(series);
            if (success == 0)
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The movie series was not added. An error occurred or the movie series was invalid.");
                return;
            }

            var newSeries = movieSeriesRepository.GetMovieSeriesByName(seriesName);
            foreach (var film in filmsInSeries)
            {
                var movie = new Movie(film.Title, Convert.ToDecimal(film.Runtime), true, newSeries?.Id, film.ReleaseDate!.Value.Year, false);

                // Add movie to the database.
            }
        }

        /// <summary>
        /// Adds a movie to the database.
        /// </summary>
        private void AddMovie()
        {
            Console.Clear();
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
        /// Prompts the next decision from the user.
        /// </summary>
        /// <param name="typeString">The type string message.</param>
        private static void PromptUser(string typeString)
        {
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage(typeString);
            Console.ResetColor();
            ConsoleHelper.NewLine();
            Console.Write(">> ");
        }
    }
}