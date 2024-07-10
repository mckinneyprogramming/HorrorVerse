using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Performers;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;

namespace HorrorTracker.ConsoleApp.DataHelpers
{
    [ExcludeFromCodeCoverage]
    public static class SeriesHelper
    {
        /// <summary>
        /// Prints the search results based on the users search of TMDB API.
        /// </summary>
        /// <param name="result">The results.</param>
        public static void DisplaySearchResults(SearchContainer<SearchCollection> result)
        {
            ConsoleHelper.NewLine();
            Console.ForegroundColor = ConsoleColor.DarkGray;
            ConsoleHelper.TypeMessage("The following series were found based on your input:");
            Console.ForegroundColor = ConsoleColor.Magenta;
            foreach (var collection in result.Results)
            {
                Console.WriteLine($"- {collection.Name}; Id: {collection.Id}\n" +
                    $"  - {collection.Overview}");
            }
        }

        /// <summary>
        /// Retrieves the users input for the series id.
        /// </summary>
        /// <returns>The series id.</returns>
        public static int PromptForSeriesId()
        {
            ConsoleHelper.TypeStringPromptUser("Choose the series id above to add the series information to the database as well as its associated movies.");
            var collectionIdSelection = ConsoleHelper.GetUserInput();
            var parser = new Parser();
            if (parser.IsInteger(collectionIdSelection, out var collectionId))
            {
                return collectionId;
            }

            return 0;
        }

        /// <summary>
        /// Collects the films in the series.
        /// </summary>
        /// <param name="movieDatabaseService">TMDB API service.</param>
        /// <param name="parts">The movies in the series.</param>
        /// <returns>The list of films.</returns>
        public static List<TMDbLib.Objects.Movies.Movie> FetchFilmsInSeries(MovieDatabaseService movieDatabaseService, List<SearchMovie> parts)
        {
            var filmsInSeries = new List<TMDbLib.Objects.Movies.Movie>();
            foreach (var part in parts.Where(part => part.ReleaseDate != null))
            {
                var film = movieDatabaseService.GetMovie(part.Id).Result;
                filmsInSeries.Add(film);
            }

            return filmsInSeries;
        }

        /// <summary>
        /// Creates the movie series.
        /// </summary>
        /// <param name="collectionInformation">The collection information.</param>
        /// <param name="filmsInSeries">The films in the series.</param>
        /// <returns>The movie series.</returns>
        public static MovieSeries CreateMovieSeries(Collection collectionInformation, List<TMDbLib.Objects.Movies.Movie> filmsInSeries)
        {
            var totalTimeOfFims = Convert.ToInt32(filmsInSeries.Sum(film => film.Runtime));
            var seriesName = collectionInformation.Name.Replace("Collection", string.Empty).Trim();
            var numberOfFilms = collectionInformation.Parts.Count(part => part.ReleaseDate != null);
            return new MovieSeries(seriesName, totalTimeOfFims, numberOfFilms, false);
        }

        /// <summary>
        /// Adds the films in a series to the database.
        /// </summary>
        /// <param name="filmsInSeries">Films in the movie series.</param>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="seriesId">The movie series id.</param>
        /// <param name="logger">The logger.</param>
        public static void AddFilmsInSeriesToDatabase(
            List<TMDbLib.Objects.Movies.Movie> filmsInSeries,
            DatabaseConnection databaseConnection,
            int seriesId,
            LoggerService logger)
        {
            foreach (var film in filmsInSeries)
            {
                var movie = new Movie(film.Title, Convert.ToDecimal(film.Runtime), true, seriesId, film.ReleaseDate!.Value.Year, false);
                var movieRepository = new MovieRepository(databaseConnection, logger);

                if (!Inserter.MovieAddedSuccessfully(movieRepository, movie))
                {
                    Console.ForegroundColor = ConsoleColor.DarkRed;
                    Console.WriteLine("The movie was not added. An error occurred or the movie was invalid.");
                    return;
                }

                ConsoleHelper.DatabaseSuccessfulMessage($"The movie '{film.Title}' was added successfully.");
            }
        }
    }
}