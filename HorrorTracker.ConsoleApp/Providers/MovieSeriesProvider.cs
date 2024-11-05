using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Providers.Abstractions;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Providers
{
    /// <summary>
    /// The <see cref="MovieSeriesProvider"/> class.
    /// </summary>
    /// <see cref="FullLengthProvider"/>
    /// <seealso cref="ProviderBase"/>
#pragma warning disable CS8602 // Dereference of a possibly null reference.
#pragma warning disable CS8604 // Possible null reference argument.
    public class MovieSeriesProvider : FullLengthProvider
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
        /// The logger service.
        /// </summary>
        private readonly LoggerService _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeriesProvider"/> class.
        /// </summary>
        /// <param name="connectionString">The connection string.</param>
        /// <param name="parser">The parser.</param>
        /// <param name="logger">The logger service.</param>
        public MovieSeriesProvider(string connectionString, Parser parser, LoggerService logger)
        {
            _connectionString = connectionString;
            _parser = parser;
            _logger = logger;
        }

        /// <summary>
        /// Searches for a movie series to add to the database.
        /// </summary>
        /// <param name="decision">The user decision.</param>
        public void SearchForMovieSeries(string decision)
        {
            if (_parser.StringIsNull(decision))
            {
                return;
            }

            var movieDatabaseService = CreateMovieDatabaseService();
            var result = movieDatabaseService.SearchCollection($"{decision} Collection").Result;

            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("The following series were found based on your input:");
            Console.ForegroundColor = ConsoleColor.Magenta;
            foreach (var collection in result.Results)
            {
                Console.WriteLine($"- {collection.Name}; Id: {collection.Id}\n" +
                    $"  - {collection.Overview}");
            }

            var collectionId = PromptForSeriesId();
            if (collectionId == 0)
            {
                return;
            }

            AddSeriesAndMoviesToDatabase(movieDatabaseService, collectionId, _connectionString, _logger);
        }

        /// <summary>
        /// Finds series that a user might want to explore and add.
        /// </summary>
        /// <param name="genreInt">The genre that they would like to search.</param>
        public void FindSeriesToAdd(int genreInt)
        {
            var movieDatabaseService = CreateMovieDatabaseService();
            var totalPages = movieDatabaseService.GetNumberOfPages(genreInt).Result;

            Console.ForegroundColor = ConsoleColor.Magenta;
            Console.WriteLine($"There are {totalPages} pages of films for the selected genre in TMDB API.");
            Console.ResetColor();
            ConsoleHelper.TypeMessage("Provide the number of pages you would like to search to find collections. We recommand no more than 400.");
            Console.Write("Start: ");
            var startPage = Console.ReadLine();
            Console.Write("End: ");
            var endPage = Console.ReadLine();

            var startPageNotValid = !_parser.IsInteger(startPage, out var startInt);
            var endPageNotValid = !_parser.IsInteger(endPage, out var endInt);
            if (startPageNotValid || endPageNotValid)
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The start or end page was not a valid number.");
                return;
            }

            if (startInt > endInt || endInt > totalPages)
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The start page is greater than the end page or the end page is greater than the last page number.");
                return;
            }

            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine("Please stand by.");
            var collectionsFromCall = movieDatabaseService.GetHorrorCollections(startInt, endInt, genreInt).Result;
            Console.WriteLine("The following film series were found:");

            Console.ForegroundColor = ConsoleColor.Magenta;
            foreach (var series in collectionsFromCall)
            {
                Console.WriteLine($"- {series.Name}; Id: {series.Id}");
            }

            var collectionIds = PromptForSeriesIds();
            if (collectionIds.Count == 0)
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("You did not provide a valid integer. Please try again.");
                Thread.Sleep(1000);
                Console.Clear();
                return;
            }

            AddCollectionsAndMoviesToDatabase(movieDatabaseService, collectionIds, _connectionString, _logger, _parser);
        }

        /// <summary>
        /// Retrieves the users input for the series id.
        /// </summary>
        /// <returns>The series id.</returns>
        private int PromptForSeriesId()
        {
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("Choose the series id above to add the series information to the database as well as its associated movies.");
            Console.ResetColor();
            Console.WriteLine();
            Console.Write(">> ");

            var collectionIdSelection = Console.ReadLine();
            if (_parser.IsInteger(collectionIdSelection, out var collectionId))
            {
                return collectionId;
            }

            return 0;
        }

        /// <summary>
        /// Retrieves the users list of series ids.
        /// </summary>
        /// <returns>List of integer series ids.</returns>
        private List<int> PromptForSeriesIds()
        {
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("Choose as many series ids above to add the series information to the database as well as its associated movies.");
            ConsoleHelper.TypeMessage("Separate the Ids by commas.");
            Console.ResetColor();
            Console.WriteLine();
            Console.Write(">> ");

            var idsSelection = Console.ReadLine();
            if (_parser.StringIsNull(idsSelection))
            {
                return [];
            }

            var ids = idsSelection.Split(",");
            var listOfIds = new List<int>();
            foreach (var id in ids)
            {
                if (_parser.IsInteger(id, out var integerId))
                {
                    listOfIds.Add(integerId);
                }
            }

            return listOfIds;
        }
    }
#pragma warning restore CS8602 // Dereference of a possibly null reference.
#pragma warning restore CS8604 // Possible null reference argument.
}