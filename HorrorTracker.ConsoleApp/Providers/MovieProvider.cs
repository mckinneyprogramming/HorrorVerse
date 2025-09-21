using HorrorTracker.ConsoleApp.Factories;
using HorrorTracker.ConsoleApp.Interfaces;
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
    /// <param name="logger">The logger service.</param>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public class MovieProvider(string connectionString, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
        : FullLengthProvider(connectionString, logger, horrorConsole, systemFunctions)
    {
        /// <summary>
        /// Displays the upcoming horror films.
        /// </summary>
        public void UpcomingHorrorFilms()
        {
            HorrorConsole.Clear();
            HorrorConsole.SetForegroundColor(ConsoleColor.Red);
            HorrorConsole.MarkupLine("========== Display Upcoming Movies ==========");
            HorrorConsole.ResetColor();

            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.DarkGray, 25, "Below will display the next two years of upcoming horror films.");

            var currentDate = DateTime.Now;
            var twoYearsFromNow = currentDate.AddYears(2);

            var movieDatabaseService = CreateMovieDatabaseService();
            var upcomingMovies = movieDatabaseService.GetUpcomingHorrorMovies().Result;
            var filteredMovies = upcomingMovies
                .Where(movie => movie.ReleaseDate.HasValue && movie.ReleaseDate.Value <= twoYearsFromNow)
                .OrderBy(movie => movie.ReleaseDate);

            HorrorConsole.ResetColor();
            HorrorConsole.MarkupLine("Upcoming Horror Movies (Next 2 Years):");
            HorrorConsole.SetForegroundColor(ConsoleColor.Magenta);
            foreach (var movie in filteredMovies)
            {
                HorrorConsole.MarkupLine($"- {movie.Title} (Release Date: {movie.ReleaseDate?.ToString("yyyy-MM-dd")})");
            }

            HorrorConsole.ResetColor();
            HorrorConsole.Write("Press any key to return to the main menu...");
            HorrorConsole.ReadKey(true);
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

            if (result == null)
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("No movie was found based on your search. Please try again.");
                return;
            }

            HorrorConsole.WriteLine();
            var themersFactory = new ThemersFactory(HorrorConsole, SystemFunctions);
            themersFactory.SpookyTextStyler.Typewriter(ConsoleColor.DarkGray, 25, "Choose a movie you want to add to the database.");

            var movieChoices = new List<string>();
            foreach (var movie in result.Results)
            {
                movieChoices.Add($"- Id: {movie.Id}; Title: {movie.Title}\n" +
                    $"  - {movie.Overview}");
            }

            var movieSelection = themersFactory.SpookyTextStyler.InteractiveMenu("--- Movie Selection ---", [.. movieChoices]);
            var movieSelectionId = movieSelection.Split(':');
            var movieId = movieSelectionId[1].Trim();
            if (!Parser.IsInteger(movieId, out var movieIdInt))
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("The provided movie id is not an integer. Please try again.");
                return;
            }

            var movieInformation = movieDatabaseService.GetMovie(movieIdInt).Result;
            var databaseConnection = new DatabaseConnection(ConnectionString);

            HorrorConsole.MarkupLine("We are checking if the movie is already in your database. Please stand by.");
            SystemFunctions.Sleep(2000);

            var collection = movieInformation.BelongsToCollection;
            var movieRepository = new MovieRepository(databaseConnection, Logger);
            var movieSeriesRepository = new MovieSeriesRepository(databaseConnection, Logger);
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
            HorrorConsole.MarkupLine("Our records show that your selected movie is already in your database. We will go one step further to see if it belongs to a series.");

            if (!Parser.StringIsNull(collection.Name) && existingMovie.PartOfSeries)
            {
                HorrorConsole.MarkupLine("Our records indicate that your movie is part of a series and you have that in your database. Please search for a different movie.");
                SystemFunctions.Sleep(2000);
                return;
            }

            if (!Parser.StringIsNull(collection.Name) && !existingMovie.PartOfSeries)
            {
                HorrorConsole.MarkupLine("TMDB indicates that this movie is part of a series, but you do not have that in your database.");
                HorrorConsole.MarkupLine("We will check if the series is already in your database.");
                SystemFunctions.Sleep(2000);

                var series = movieSeriesRepository.GetByTitle(collection.Name.Replace("Collection", string.Empty).Trim());
                if (series != null)
                {
                    HorrorConsole.MarkupLine("We found the series in your database. We will update the movie in the database and associate it with the series.");
                    existingMovie.PartOfSeries = true;
                    existingMovie.SeriesId = series.Id;
                    movieRepository.Update(existingMovie);
                    movieSeriesRepository.UpdateTotalMovies(series.Id);
                    movieSeriesRepository.UpdateTotalTime(series.Id);
                }
                else
                {
                    HorrorConsole.MarkupLine("The series is not found at all in your database. We will grab the series and add it to your database and its movies.");
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
            HorrorConsole.MarkupLine("Another movie to add to your database! We are now going to check if it is part of a series.");
            SystemFunctions.Sleep(2000);
            if (!Parser.StringIsNull(collection.Name))
            {
                HorrorConsole.MarkupLine("Looks like the movie is part of a series. We will see if that series already exists in your database.");
                var series = movieSeriesRepository.GetByTitle(collection.Name.Replace("Collection", string.Empty).Trim());
                if (series != null)
                {
                    HorrorConsole.MarkupLine("We found the series in your database. We will add the movie to the database and associate it with the series.");

                    var newMovie = new Movie(movieInformation.Title, Convert.ToDecimal(movieInformation.Runtime), true, series.Id, movieInformation.ReleaseDate.Value.Year, false);
                    AddMovieToDatabase(movieInformation, movieRepository, newMovie);

                    movieSeriesRepository.UpdateTotalMovies(series.Id);
                    movieSeriesRepository.UpdateTotalTime(series.Id);
                    HorrorConsole.MarkupLine("The associated movie series was also updated for total movies and total runtime.");
                }
                else
                {
                    HorrorConsole.MarkupLine("The series is not found at all in your database. We will grab the series and add it to your database and its movies.");
                    AddSeriesAndMoviesToDatabase(movieDatabaseService, collection.Id);
                }
            }
            else
            {
                HorrorConsole.MarkupLine("This movie is not part of a movie series (not yet anyway!). We will get this movie added to your database.");
                var newMovie = new Movie(movieInformation.Title, Convert.ToDecimal(movieInformation.Runtime), false, null, movieInformation.ReleaseDate.Value.Year, false);
                AddMovieToDatabase(movieInformation, movieRepository, newMovie);
            }
        }
    }
}