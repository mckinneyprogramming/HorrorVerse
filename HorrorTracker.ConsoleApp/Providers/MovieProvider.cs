using HorrorTracker.ConsoleApp.ConsoleHelpers;
using HorrorTracker.ConsoleApp.Providers.Abstractions;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.PostgreHelpers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging;
using TMDbLib.Objects.Search;

namespace HorrorTracker.ConsoleApp.Providers
{
    /// <summary>
    /// The <see cref="MovieProvider"/> class.
    /// </summary>
    /// <seealso cref="FullLengthProvider"/>
    /// <seealso cref="ProviderBase"/>
    /// <remarks>
    /// Initializes a new instance of the <see cref="MovieProvider"/> class.
    /// </remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="parser">The parser.</param>
    /// <param name="logger">The logger service.</param>
#pragma warning disable CS8602 // Dereference of a possibly null reference.
#pragma warning disable CS8604 // Possible null reference argument.
#pragma warning disable CS8629 // Nullable value type may be null.
    public class MovieProvider(string connectionString, LoggerService logger) : FullLengthProvider(connectionString, logger)
    {
        /// <summary>
        /// Displays the upcoming horror films.
        /// </summary>
        public static void UpcomingHorrorFilms()
        {
            Console.Clear();
            ConsoleHelper.ColorWriteLineWithReset("========== Display Upcoming Movies ==========", ConsoleColor.Red);
            ConsoleHelper.TypeMessage(ConsoleColor.DarkGray, "Below will dispaly the next two years of upcoming horror films.");
            var movieDatabaseService = CreateMovieDatabaseService();
            var upcomingMovies = movieDatabaseService.GetUpcomingHorrorMovies().Result;

            var currentDate = DateTime.Now;
            var twoYearsFromNow = currentDate.AddYears(2);

            var filteredMovies = upcomingMovies
                .Where(movie => movie.ReleaseDate.HasValue && movie.ReleaseDate.Value <= twoYearsFromNow)
                .OrderBy(movie => movie.ReleaseDate);

            Console.ResetColor();
            Console.WriteLine("Upcoming Horror Movies (Next 2 Years):");
            Console.ForegroundColor = ConsoleColor.Magenta;
            foreach (var movie in filteredMovies)
            {
                Console.WriteLine($"- {movie.Title} (Release Date: {movie.ReleaseDate?.ToString("yyyy-MM-dd")})");
            }

            Console.ResetColor();
            Console.Write("Press any key to return to the main menu...");
            Console.ReadKey();
        }

        /// <summary>
        /// Searches for a movie in TMDB.
        /// </summary>
        /// <param name="decision">The user decision.</param>
        public void SearchMovie(string decision)
        {
            if (Parser.StringIsNull(decision))
            {
                return;
            }

            var movieDatabaseService = CreateMovieDatabaseService();
            var result = movieDatabaseService.SearchMovie(decision).Result;

            Console.WriteLine();
            ConsoleHelper.TypeMessage(ConsoleColor.DarkGray, "The following movies were found based on your input:");
            Console.ForegroundColor = ConsoleColor.Magenta;
            foreach (var movie in result.Results)
            {
                Console.WriteLine($"- {movie.Title}; Id: {movie.Id}\n" +
                    $"  - {movie.Overview}");
            }

            Console.WriteLine();
            ConsoleHelper.TypeMessage(ConsoleColor.DarkGray, "Choose a movie id above to select a movie you want to add to the database.");
            Console.ResetColor();
            Console.Write(">> ");
            var movieId = Console.ReadLine();
            if (!Parser.IsInteger(movieId, out var movieIdInt))
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The provided movie id is not an integer. Please try again.");
                return;
            }

            var movieInformation = movieDatabaseService.GetMovie(movieIdInt).Result;
            var collection = movieInformation.BelongsToCollection;
            var databaseConnection = new DatabaseConnection(ConnectionString);
            var movieRepository = new MovieRepository(databaseConnection, Logger);
            var movieSeriesRepository = new MovieSeriesRepository(databaseConnection, Logger);

            Console.WriteLine("We are checking if the movie is already in your database. Please stand by.");
            Thread.Sleep(2000);
            var existingMovie = movieRepository.GetByTitle(movieInformation.Title);
            if (existingMovie != null)
            {
                SearchedMovieFoundInDatabase(movieDatabaseService, collection, movieRepository, movieSeriesRepository, existingMovie);
            }
            else
            {
                SearchedMovieNotFoundInDatabase(movieDatabaseService, movieInformation, collection, movieRepository, movieSeriesRepository);
            }
        }

        /// <summary>
        /// Searched movie is found and checks if it is part of a movie series.
        /// </summary>
        /// <param name="movieDatabaseService">The movie database service.</param>
        /// <param name="collection">The search collection.</param>
        /// <param name="movieRepository">The movie repository.</param>
        /// <param name="movieSeriesRepository">The movie series repository.</param>
        /// <param name="existingMovie">The existing movie.</param>
        private void SearchedMovieFoundInDatabase(
            MovieDatabaseService movieDatabaseService,
            SearchCollection collection,
            MovieRepository movieRepository,
            MovieSeriesRepository movieSeriesRepository,
            Movie? existingMovie)
        {
            Console.WriteLine("Our records show that your selected movie is already in your database. We will go one step further to see if it belongs to a series.");

            if (!Parser.StringIsNull(collection.Name) && existingMovie.PartOfSeries)
            {
                Console.WriteLine("Our records indicate that your movie is part of a series and you have that in your database. Please search for a different movie.");
                Thread.Sleep(2000);
                return;
            }

            if (!Parser.StringIsNull(collection.Name) && !existingMovie.PartOfSeries)
            {
                Console.WriteLine("TMDB indicates that this movie is part of a series, but you do not have that in your database.");
                Console.WriteLine("We will check if the series is already in your database.");
                Thread.Sleep(2000);

                var series = movieSeriesRepository.GetByTitle(collection.Name.Replace("Collection", string.Empty).Trim());
                if (series != null)
                {
                    Console.WriteLine("We found the series in your database. We will update the movie in the database and associate it with the series.");
                    existingMovie.PartOfSeries = true;
                    existingMovie.SeriesId = series.Id;
                    movieRepository.Update(existingMovie);
                    movieSeriesRepository.UpdateTotalMovies(series.Id);
                    movieSeriesRepository.UpdateTotalTime(series.Id);
                }
                else
                {
                    Console.WriteLine("The series is not found at all in your database. We will grab the series and add it to your database and its movies.");
                    AddSeriesAndMoviesToDatabase(movieDatabaseService, collection.Id);
                }
            }
        }

        /// <summary>
        /// Searched movie is not found in the database and adds it to the database with a potential movie series.
        /// </summary>
        /// <param name="movieDatabaseService">The movie database service.</param>
        /// <param name="movieInformation">The movie information.</param>
        /// <param name="collection">The search collection.</param>
        /// <param name="movieRepository">The movie repository.</param>
        /// <param name="movieSeriesRepository">The movie series repository.</param>
        private void SearchedMovieNotFoundInDatabase(
            MovieDatabaseService movieDatabaseService,
            TMDbLib.Objects.Movies.Movie movieInformation,
            SearchCollection collection,
            MovieRepository movieRepository,
            MovieSeriesRepository movieSeriesRepository)
        {
            Console.WriteLine("Another movie to add to your database! We are now going to check if it is part of a series.");
            Thread.Sleep(2000);
            if (!Parser.StringIsNull(collection.Name))
            {
                Console.WriteLine("Looks like the movie is part of a series. We will see if that series already exists in your database.");
                var series = movieSeriesRepository.GetByTitle(collection.Name.Replace("Collection", string.Empty).Trim());
                if (series != null)
                {
                    Console.WriteLine("We found the series in your database. We will add the movie to the database and associate it with the series.");

                    var newMovie = new Movie(movieInformation.Title, Convert.ToDecimal(movieInformation.Runtime), true, series.Id, movieInformation.ReleaseDate.Value.Year, false);
                    AddMovieToDatabase(movieInformation, movieRepository, newMovie);

                    movieSeriesRepository.UpdateTotalMovies(series.Id);
                    movieSeriesRepository.UpdateTotalTime(series.Id);
                    Console.WriteLine("The associated movie series was also updated for total movies and total runtime.");
                }
                else
                {
                    Console.WriteLine("The series is not found at all in your database. We will grab the series and add it to your database and its movies.");
                    AddSeriesAndMoviesToDatabase(movieDatabaseService, collection.Id);
                }
            }
            else
            {
                Console.WriteLine("This movie is not part of a movie series (not yet anyway!). We will get this movie added to your database.");
                var newMovie = new Movie(movieInformation.Title, Convert.ToDecimal(movieInformation.Runtime), false, null, movieInformation.ReleaseDate.Value.Year, false);
                AddMovieToDatabase(movieInformation, movieRepository, newMovie);
            }
        }
    }
#pragma warning restore CS8602 // Dereference of a possibly null reference.
#pragma warning restore CS8604 // Possible null reference argument.
#pragma warning restore CS8629 // Nullable value type may be null.
}