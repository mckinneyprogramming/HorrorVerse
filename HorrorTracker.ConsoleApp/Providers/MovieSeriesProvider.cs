using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;
using NAudio.Mixer;
using TMDbLib.Objects.Search;

namespace HorrorTracker.ConsoleApp.Providers
{
    /// <summary>
    /// The <see cref="MovieSeriesProvider"/> class.
    /// </summary>
    /// <see cref="FullLengthProvider"/>
    /// <seealso cref="ProviderBase"/>
    /// <remarks>
    /// Initializes a new instance of the <see cref="MovieSeriesProvider"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class MovieSeriesProvider(string connectionString, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
        : FullLengthProvider(connectionString, logger, horrorConsole, systemFunctions)
    {
        /// <summary>
        /// Searches for a movie series to add to the database.
        /// </summary>
        /// <param name="decision">The user decision.</param>
        public void SearchForMovieSeries(string decision)
        {
            if (Parser.StringIsNull(decision))
            {
                return;
            }

            var movieDatabaseService = CreateMovieDatabaseService();
            var result = movieDatabaseService.SearchCollection($"{decision} Collection").Result;

            var collectionId = PromptForSeriesId(result.Results);
            if (collectionId == 0)
            {
                return;
            }

            AddSeriesAndMoviesToDatabase(movieDatabaseService, collectionId);
        }

        /// <summary>
        /// Finds series that a user might want to explore and add.
        /// </summary>
        /// <param name="genreInt">The genre that they would like to search.</param>
        public void FindSeriesToAdd(int genreInt)
        {
            var movieDatabaseService = CreateMovieDatabaseService();
            var totalPages = movieDatabaseService.GetNumberOfPages(genreInt).Result;

            HorrorConsole.SetForegroundColor(ConsoleColor.Magenta);
            HorrorConsole.MarkupLine($"There are {totalPages} pages of films for the selected genre in TMDB API.");

            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(
                ConsoleColor.White,
                25,
                "Provide the number of pages you would like to search to find collections. We recommand no more than 400.");
            HorrorConsole.Write("Start: ");
            var startPage = HorrorConsole.ReadLine();
            HorrorConsole.Write("End: ");
            var endPage = HorrorConsole.ReadLine();

            var startPageNotValid = !Parser.IsInteger(startPage, out var startInt);
            var endPageNotValid = !Parser.IsInteger(endPage, out var endInt);
            if (startPageNotValid || endPageNotValid)
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("The start or end page was not a valid number.");
                return;
            }

            if (startInt > endInt || endInt > totalPages)
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("The start page is greater than the end page or the end page is greater than the last page number.");
                return;
            }

            HorrorConsole.SetForegroundColor(ConsoleColor.DarkGray);
            HorrorConsole.MarkupLine("Please stand by.");
            HorrorConsole.MarkupLine("The following film series were found:");
            HorrorConsole.SetForegroundColor(ConsoleColor.Magenta);

            var collectionsFromCall = movieDatabaseService.GetHorrorCollections(startInt, endInt, genreInt).Result;
            foreach (var series in collectionsFromCall)
            {
                HorrorConsole.MarkupLine($"- {series.Name}; Id: {series.Id}");
            }

            var collectionIds = PromptForSeriesIds();
            if (collectionIds.Count == 0)
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("You did not provide a valid integer. Please try again.");
                SystemFunctions.Sleep(1000);
                HorrorConsole.Clear();
                return;
            }

            AddCollectionsAndMoviesToDatabase(movieDatabaseService, collectionIds);
        }

        /// <summary>
        /// Retrieves the users input for the series id.
        /// </summary>
        /// <param name="collectionResults">The list of collections.</param>
        /// <returns>The series id.</returns>
        private int PromptForSeriesId(List<SearchCollection> collectionResults)
        {
            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(
                ConsoleColor.DarkGray,
                25,
                "Choose the series below to add the series information to the database as well as its associated movies.");

            HorrorConsole.WriteLine();

            var listOfCollections = new List<string>();
            foreach (var collection in collectionResults)
            {
                listOfCollections.Add($"- Id: {collection.Id}; Name: {collection.Name}\n" +
                    $"  - {collection.Overview}");
            }

            var collectionSelection = themersFactory.SpookyTextStyler.InteractiveMenu("--- Collection Selection ---", [.. listOfCollections]);
            var collectionSelectionSplit = collectionSelection.Split(':');
            var collectionIdString = collectionSelectionSplit[1].Trim();
            if (Parser.IsInteger(collectionIdString, out var collectionId))
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
            HorrorConsole.SetForegroundColor(ConsoleColor.DarkGray);
            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(
                ConsoleColor.DarkGray,
                25,
                "Choose as many series ids above to add the series information to the database as well as its associated movies.",
                "Separate the Ids by commas.");

            HorrorConsole.ResetColor();
            HorrorConsole.WriteLine();
            HorrorConsole.Write(">> ");

            var idsSelection = HorrorConsole.ReadLine();
            if (Parser.StringIsNull(idsSelection))
            {
                return [];
            }

            var ids = idsSelection.Split(",");
            var listOfIds = new List<int>();
            foreach (var id in ids)
            {
                if (Parser.IsInteger(id, out var integerId))
                {
                    listOfIds.Add(integerId);
                }
            }

            return listOfIds;
        }
    }
}