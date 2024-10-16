using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Models;
using HorrorTracker.MSTests.Shared;
using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.MSTests.Data.Constants.Parameters
{
    [TestClass]
    [ExcludeFromCodeCoverage]
    public class DatabaseParametersHelperTests
    {
        [TestMethod]
        public void CreateHorrorObjectParameters_WhenObjectIsMovieSeries_ShouldCreateAndReturnCorrectParameters()
        {
            // Arrange
            var movieSeries = Fixtures.MovieSeries();
            var expectedParameters = new ReadOnlyDictionary<string, object>(ExpectedMovieSeriesParameters(movieSeries));

            // Act
            var actualParameters = DatabaseParametersHelper.CreateHorrorObjectParameters(movieSeries);

            // Assert
            Assert.IsNotNull(actualParameters);
            CollectionAssert.AreEqual(expectedParameters, new ReadOnlyDictionary<string, object>(actualParameters));
        }

        [TestMethod]
        public void CreateHorrorObjectParameters_WhenObjectIsMovieWithoutSeriesId_ShouldCreateAndReturnCorrectParameters()
        {
            // Arrange
            var movie = Fixtures.Movie();
            movie.SeriesId = null;
            movie.PartOfSeries = false;
            var expectedParameters = new ReadOnlyDictionary<string, object>(ExpectedMovieParameters(movie, movie.SeriesId));

            // Act
            var actualParameters = DatabaseParametersHelper.CreateHorrorObjectParameters(movie);

            // Assert
            Assert.IsNotNull(actualParameters);
            Assert.AreEqual(actualParameters.Values.Last(), DBNull.Value);
            CollectionAssert.AreEqual(expectedParameters, new ReadOnlyDictionary<string, object>(actualParameters));
        }

        [TestMethod]
        public void CreateHorrorObjectParameters_WhenObjectIsMovieWithSeriesId_ShouldCreateAndReturnCorrectParameters()
        {
            // Arrange
            var movie = Fixtures.Movie();
            movie.PartOfSeries = true;
            var expectedParameters = new ReadOnlyDictionary<string, object>(ExpectedMovieParameters(movie, movie.SeriesId));

            // Act
            var actualParameters = DatabaseParametersHelper.CreateHorrorObjectParameters(movie);

            // Assert
            Assert.IsNotNull(actualParameters);
            Assert.IsTrue(actualParameters.ContainsKey("SeriesId"));
            CollectionAssert.AreEqual(expectedParameters, new ReadOnlyDictionary<string, object>(actualParameters));
        }

        [TestMethod]
        public void CreateReadOnlyDictionary_WhenDictionaryIsPassedIn_ShouldReturnReadOnlyDictionary()
        {
            // Arrange
            var movieSeries = Fixtures.MovieSeries();
            var parameters = ExpectedMovieSeriesParameters(movieSeries);

            // Act
            var actualDictionary = DatabaseParametersHelper.CreateReadOnlyDictionary(parameters);

            // Assert
            var expectedReadOnlyDictionary = new ReadOnlyDictionary<string, object>(parameters);

            Assert.IsNotNull(actualDictionary);
            Assert.IsInstanceOfType(actualDictionary, typeof(ReadOnlyDictionary<string, object>));
            CollectionAssert.AreEqual(expectedReadOnlyDictionary, actualDictionary);
        }

        private static Dictionary<string, object> ExpectedMovieSeriesParameters(MovieSeries movieSeries)
        {
            var parameters = new Dictionary<string, object>
            {
                { "Title", movieSeries.Title },
                { "TotalTime", movieSeries.TotalTime },
                { "Watched", movieSeries.Watched },
                { "TotalMovies", movieSeries.TotalMovies }
            };

            return new Dictionary<string, object>(parameters);
        }

        private static Dictionary<string, object> ExpectedMovieParameters(Movie movie, int? seriesId)
        {
            var parameters = new Dictionary<string, object>
            {
                { "Title", movie.Title },
                { "TotalTime", movie.TotalTime },
                { "Watched", movie.Watched },
                { "PartOfSeries", movie.PartOfSeries },
                { "ReleaseYear", movie.ReleaseYear }
            };

            if (seriesId.HasValue)
            {
                parameters.Add("SeriesId", seriesId);
            }
            else
            {
                parameters.Add("SeriesId", DBNull.Value);
            }

            return new Dictionary<string, object>(parameters);
        }
    }
}