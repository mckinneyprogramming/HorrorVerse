using HorrorTracker.Data.Models;
using HorrorTracker.Data.Performers;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;

namespace HorrorTracker.ConsoleApp.Providers.Abstractions
{
    /// <summary>
    /// The <see cref="ProviderBase"/> class.
    /// </summary>
    /// <remarks>Initializes a new instance of the <see cref="ProviderBase"/> class.</remarks>
    /// <param name="connectionString">The connection string.</param>
    public abstract class ProviderBase(string? connectionString)
    {
        /// <summary>
        /// The connection string.
        /// </summary>
        protected readonly string? ConnectionString = connectionString;

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
        protected static void AddMovieToDatabase(TMDbLib.Objects.Movies.Movie movieInformation, MovieRepository movieRepository, Movie movie)
        {
            if (!Inserter.MovieAddedSuccessfully(movieRepository, movie))
            {
                Console.ForegroundColor = ConsoleColor.DarkRed;
                Console.WriteLine("The movie you are trying to add already exists in the database or an error occurred. Please try a different movie.");
                return;
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"Movie: {movieInformation.Title} was added to the database successfully.");
            Thread.Sleep(2000);
        }
    }
}