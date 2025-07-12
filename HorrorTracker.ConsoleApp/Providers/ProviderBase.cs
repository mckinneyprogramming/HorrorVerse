using HorrorTracker.ConsoleApp.Interfaces;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Performers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;
using HorrorTracker.Utilities.Logging;
using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.ConsoleApp.Providers
{
    /// <summary>
    /// The <see cref="ProviderBase"/> class.
    /// </summary>
    /// <remarks>Initializes a new instance of the <see cref="ProviderBase"/> class.</remarks>
    /// <param name="connectionString">The connection string.</param>
    /// <param name="logger">The logger service.</param>
    /// <param name="horrorConsole">The horror console.</param>
    /// <param name="systemFunctions">The system functions.</param>
    public abstract class ProviderBase(string? connectionString, LoggerService logger, IHorrorConsole horrorConsole, ISystemFunctions systemFunctions)
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        protected readonly string? ConnectionString = connectionString;

        /// <summary>
        /// The logger service.
        /// </summary>
        protected readonly LoggerService Logger = logger;

        /// <summary>
        /// The horror console.
        /// </summary>
        protected readonly IHorrorConsole HorrorConsole = horrorConsole;

        /// <summary>
        /// The system functions.
        /// </summary>
        protected readonly ISystemFunctions SystemFunctions = systemFunctions;

        /// <summary>
        /// The parser.
        /// </summary>
        protected readonly Parser Parser = new();

        /// <summary>
        /// Creates TMDB API service.
        /// </summary>
        /// <returns>The movie database service.</returns>
        protected static MovieDatabaseService CreateMovieDatabaseService()
        {
            var movieDatabaseConfig = new MovieDatabaseConfig();
            var movieDatabaseClientWrapper = new TMDbClientWrapper(movieDatabaseConfig.GetApiKey());
            return new MovieDatabaseService(movieDatabaseClientWrapper);
        }

        /// <summary>
        /// Adds the movie to the database.
        /// </summary>
        /// <param name="movieInformation">The movie information.</param>
        /// <param name="movieRepository">The movie repository.</param>
        /// <param name="movie">The new movie.</param>
        protected void AddMovieToDatabase(TMDbLib.Objects.Movies.Movie movieInformation, MovieRepository movieRepository, Movie movie)
        {
            if (!Inserter.MovieAddedSuccessfully(movieRepository, movie))
            {
                HorrorConsole.SetForegroundColor(ConsoleColor.DarkRed);
                HorrorConsole.MarkupLine("The movie you are trying to add already exists in the database or an error occurred. Please try a different movie.");
                return;
            }

            HorrorConsole.SetForegroundColor(ConsoleColor.Green);
            HorrorConsole.MarkupLine($"Movie: {movieInformation.Title} was added to the database successfully.");
            SystemFunctions.Sleep(2000);
        }
    }
}