using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Performers;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.Search;

namespace HorrorTracker.ConsoleApp.Managers.Helperrs
{
    /// <summary>
    /// The <see cref="MovieDatabaseApiManagerHelper"/> class.
    /// </summary>
    [SuppressMessage("Performance", "CA1822:Mark members as static", Justification = "Non-static by design.")]
    public class MovieDatabaseApiManagerHelper
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        private readonly string? _connectionString;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly LoggerService _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="MovieDatabaseApiManagerHelper"/> class.
        /// </summary>
        /// <param name="logger">The logger service.</param>
        /// <param name="connectionString">The connection string.</param>
        public MovieDatabaseApiManagerHelper(LoggerService logger, string? connectionString)
        {
            _logger = logger;
            _connectionString = connectionString;
        }

        /// <summary>
        /// Adds the collections and the movies from TMBD to the database.
        /// </summary>
        /// <param name="movieDatabaseService">The movie database service.</param>
        /// <param name="collectionIds">The list of collection ids.</param>
        public void AddCollectionsAndMoviesToDatabase(MovieDatabaseService movieDatabaseService, List<int> collectionIds)
        {
            foreach (var collectionId in collectionIds)
            {
                var collectionInformation = movieDatabaseService.GetCollection(collectionId).Result;
                var collectionName = collectionInformation.Name.Replace("Collection", "").Trim();
                var databaseConnection = new DatabaseConnection(_connectionString);
                var movieSeriesRepository = new MovieSeriesRepository(databaseConnection, _logger);
                var seriesExists = movieSeriesRepository.GetByTitle(collectionName);
                if (seriesExists != null)
                {
                    Console.ForegroundColor = ConsoleColor.DarkRed;
                    Console.WriteLine("The series you selected already exists in the database. Please try again.");
                    Thread.Sleep(1000);
                    Console.Clear();
                    return;
                }

                var filmsInSeries = FetchFilmsInSeries(movieDatabaseService, collectionInformation.Parts);
                Console.ForegroundColor = ConsoleColor.Magenta;
                Console.WriteLine($"Series Name: {collectionInformation.Name}; Parts:");
                foreach (var film in filmsInSeries)
                {
                    Console.WriteLine($"- Title: {film.Title}; Runtime: {film.Runtime}, Release Year: {film.ReleaseDate!.Value.Year}\n" +
                        $"   - Overview {film.Overview}");
                }

                Console.ForegroundColor = ConsoleColor.DarkGray;
                ConsoleHelper.TypeMessage("Would you like to add this series and its movies to your database? Type Y or N");
                Console.ResetColor();
                Console.WriteLine();
                Console.Write(">> ");
                var addToDatabase = Console.ReadLine();
                if (string.IsNullOrWhiteSpace(addToDatabase) || !addToDatabase.Equals("Y", StringComparison.CurrentCultureIgnoreCase))
                {
                    continue;
                }

                var newSeries = new MovieSeries(collectionName, Convert.ToDecimal(filmsInSeries.Sum(s => s.Runtime)), filmsInSeries.Count, false);
                if (!Inserter.MovieSeriesAddedSuccessfully(movieSeriesRepository, newSeries))
                {
                    Console.ForegroundColor = ConsoleColor.DarkRed;
                    Console.WriteLine("The movie series you are trying to add already exists in the database or an error occurred. Please try a different series.");
                    continue;
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"The movie series '{newSeries.Title}' was added successfully.");
                Thread.Sleep(1000);
                Console.ResetColor();

                var addedSeries = movieSeriesRepository.GetByTitle(newSeries.Title);
                if (addedSeries == null)
                {
                    continue;
                }

                AddFilmsToDatabase(databaseConnection, filmsInSeries, addedSeries.Id);
                SeriesAddedToDatabaseMessages(addedSeries.Title);
            }
        }

        /// <summary>
        /// Displays the message for the series being added to the database.
        /// </summary>
        /// <param name="title">The series title.</param>
        public void SeriesAddedToDatabaseMessages(string title)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"Movie series: {title} was added successfully as well as the movies in the series.");
            Thread.Sleep(2000);
            Console.ResetColor();
        }

        /// <summary>
        /// Adds the films from the collection to the database.
        /// </summary>
        /// <param name="databaseConnection">The database connection.</param>
        /// <param name="filmsInSeries">The films to add to the database.</param>
        /// <param name="addedSeriesId">The movie series id.</param>
        public void AddFilmsToDatabase(DatabaseConnection databaseConnection, List<TMDbLib.Objects.Movies.Movie> filmsInSeries, int addedSeriesId)
        {
            foreach (var film in filmsInSeries)
            {
                var movie = new Movie(film.Title, Convert.ToDecimal(film.Runtime), true, addedSeriesId, film.ReleaseDate!.Value.Year, false);
                var movieRepository = new MovieRepository(databaseConnection, _logger);

                if (!Inserter.MovieAddedSuccessfully(movieRepository, movie))
                {
                    Console.ForegroundColor = ConsoleColor.DarkRed;
                    Console.WriteLine("The movie was not added. An error occurred or the movie was invalid.");
                    continue;
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"The movie '{film.Title}' was added successfully.");
                Thread.Sleep(1000);
                Console.ResetColor();
            }
        }

        /// <summary>
        /// Collects the films in the series.
        /// </summary>
        /// <param name="movieDatabaseService">TMDB API service.</param>
        /// <param name="parts">The movies in the series.</param>
        /// <returns>The list of films.</returns>
        public List<TMDbLib.Objects.Movies.Movie> FetchFilmsInSeries(MovieDatabaseService movieDatabaseService, List<SearchMovie> parts)
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
        /// Creates TMDB API service.
        /// </summary>
        /// <returns>The movie database service.</returns>
        public MovieDatabaseService CreateMovieDatabaseService()
        {
            var movieDatabaseConfig = new MovieDatabaseConfig();
            var movieDatabaseClientWrapper = new TMDbClientWrapper(movieDatabaseConfig.GetApiKey());
            return new MovieDatabaseService(movieDatabaseClientWrapper);
        }
    }
}