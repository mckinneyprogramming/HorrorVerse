using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Utilities.Helpers;
using HorrorTracker.Utilities.Helpers.Interfaces;
using HorrorTracker.Utilities.Logging.Interfaces;
using HorrorTracker.Utilities.Parsing;
using TMDbLib.Objects.Search;

namespace HorrorTracker.ConsoleApp.Providers
{
    /// <summary>
    /// Provides functionality for searching, selecting, and adding movie series and their associated movies to the
    /// database, with support for user interaction and genre-based exploration.
    /// </summary>
    /// <remarks>This provider extends FullLengthProvider to offer specialized workflows for discovering and
    /// importing movie series, including interactive prompts and genre filtering. It is intended for scenarios where
    /// users need to browse, select, and add collections of movies based on series information.</remarks>
    /// <param name="connectionString">The connection string used to access the movie database.</param>
    /// <param name="logger">The logging service used to record application events and errors.</param>
    /// <param name="horrorConsole">The console interface used for user interaction and output formatting.</param>
    /// <param name="systemFunctions">The system functions provider used for operations such as sleeping and clearing the console.</param>
    public class MovieSeriesProvider(string connectionString, ILoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
        : FullLengthProvider(connectionString, logger, horrorConsole, systemFunctions)
    {
        /// <summary>
        /// Searches for a movie series based on the specified decision and adds the series and its movies to the
        /// database if found.
        /// </summary>
        /// <remarks>This method prompts the user to select a series from the search results and adds the
        /// selected series and its movies to the database. No action is taken if no valid series is selected.</remarks>
        /// <param name="decision">The decision or name used to identify the movie series to search for. If <paramref name="decision"/> is null
        /// or empty, the method does not perform a search.</param>
        public void SearchForMovieSeries(string? decision)
        {
            if (StringHelper.StringIsNull(decision))
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
        /// Prompts the user to select a range of pages for a specified genre and displays available film series from
        /// the TMDB API, allowing the user to choose series to add to the database.
        /// </summary>
        /// <remarks>The method interacts with the user via the console to determine the page range and
        /// series selection. Input validation is performed to ensure valid page numbers and selections. The recommended
        /// maximum number of pages to search is 400 to avoid excessive API calls.</remarks>
        /// <param name="genreInt">The integer identifier of the genre to search for film series. Must correspond to a valid genre supported by
        /// the TMDB API.</param>
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
        /// Prompts the user to select a series from the provided collection results and returns the selected series
        /// identifier.
        /// </summary>
        /// <remarks>The method displays the available series collections in an interactive console menu.
        /// If the user does not select a valid series, the method returns 0. This method is intended for use in
        /// interactive console applications.</remarks>
        /// <param name="collectionResults">A list of search results representing available series collections for user selection. Cannot be null.</param>
        /// <returns>The identifier of the selected series if a valid selection is made; otherwise, 0.</returns>
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
        /// Prompts the user to enter one or more series IDs and returns a list of valid integer IDs entered.
        /// </summary>
        /// <remarks>Series IDs should be entered as a comma-separated list. Only valid integer values are
        /// included in the returned list; any non-integer or empty entries are ignored.</remarks>
        /// <returns>A list of integers representing the series IDs entered by the user. The list will be empty if no valid IDs
        /// are provided.</returns>
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
            if (StringHelper.StringIsNull(idsSelection))
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