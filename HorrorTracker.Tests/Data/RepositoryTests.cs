using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.Repositories.Constants;

namespace HorrorTracker.Tests.Data;

public class RepositoryTests
{
    [Fact]
    public void MovieRepository_ReadsWritesAndTimes()
    {
        var connection = new FakeConnection
        {
            Rows =
            [
                [1, "Halloween", 91m, false, null, 1978, true],
                [2, "Halloween II", 92m, true, 4, 1981, false],
            ],
        };
        var logger = new RecordingLogger();
        var repository = new MovieRepository(connection, logger);
        var movie = new Movie("Halloween", 91m, true, 4, 1978, true, 1);

        Assert.True(repository.Add(movie).Success);
        Assert.True(repository.Add(new Movie("Alone", 80m, false, null, 1990, false)).Success);
        Assert.False(repository.Add(movie).Success is false && connection.NonQueryResult == 0);
        connection.NonQueryResult = 0;
        Assert.False(repository.Update(movie).Success);
        connection.NonQueryResult = 1;
        Assert.True(repository.Delete(1).Success);
        Assert.Equal(2, repository.GetAll().Count());
        Assert.Equal("Halloween", repository.GetByTitle("Halloween")!.Title);
        Assert.Equal(2, repository.GetUnwatchedOrWatched(true).Count());
        Assert.Equal(2, repository.GetUnwatchedOrWatched(false).Count());
        Assert.Equal(2, repository.GetUnwatchedOrWatchedMoviesInSeries(true, "Halloween").Count());
        Assert.Equal(2, repository.GetUnwatchedOrWatchedMoviesInSeries(false, "Halloween").Count());
        Assert.Equal(12.5m, repository.GetTime("SELECT watched = true"));
        Assert.Equal(12.5m, repository.GetTime("SELECT watched = false"));
        Assert.True(connection.Opened);
        Assert.True(connection.Closed);
        Assert.NotEmpty(logger.Information);

        connection.Rows = [];
        Assert.Null(repository.GetByTitle("missing"));
        Assert.NotEmpty(logger.Warnings);

        connection.Scalar = null;
        Assert.Equal(0m, repository.GetTime("time"));
        connection.Scalar = "nope";
        Assert.Equal(0m, repository.GetTime("time"));

        connection.Failure = new InvalidOperationException("down");
        Assert.False(repository.Add(movie).Success);
        Assert.Empty(repository.GetAll());
        Assert.Null(repository.GetByTitle("Halloween"));
        Assert.Equal(0m, repository.GetTime("time"));
        Assert.NotEmpty(logger.Errors);
    }

    [Fact]
    public void SeriesRepository_UpdatesEachProperty()
    {
        var connection = new FakeConnection
        {
            Rows = [[7, "Halloween", 180m, 2, false]],
        };
        var logger = new RecordingLogger();
        var repository = new MovieSeriesRepository(connection, logger);
        var series = new MovieSeries("Halloween", 180m, 2, false, 7);

        Assert.True(repository.Add(series).Success);
        Assert.True(repository.Update(series).Success);
        Assert.True(repository.Delete(7).Success);
        Assert.True(repository.UpdateTotalTime(7).Success);
        Assert.True(repository.UpdateTotalMovies(7).Success);
        Assert.True(repository.UpdateWatched(7).Success);
        Assert.Equal("Halloween", repository.GetByTitle("Halloween")!.Title);
        Assert.Single(repository.GetAll());
        Assert.Single(repository.GetUnwatchedOrWatchedMovieSeries("watched = true"));
        Assert.Single(repository.GetUnwatchedOrWatchedMovieSeries("watched = false"));
        Assert.Equal(12.5m, repository.GetTimeLeft(7));

        connection.NonQueryResult = 0;
        Assert.False(repository.UpdateTotalTime(7).Success);
        connection.Failure = new InvalidOperationException("down");
        Assert.Empty(repository.GetAll());
        Assert.Empty(repository.GetUnwatchedOrWatchedMovieSeries("watched = true"));
    }

    [Fact]
    public void DocumentaryRepository_CoversWatchedAndUnwatched()
    {
        var connection = new FakeConnection
        {
            Rows = [[3, "Horror Noire", 83m, 2019, true]],
        };
        var logger = new RecordingLogger();
        var repository = new DocumentaryRepository(connection, logger);
        var documentary = new Documentary("Horror Noire", 83m, 2019, true, 3);

        Assert.True(repository.Add(documentary).Success);
        Assert.True(repository.Update(documentary).Success);
        Assert.True(repository.Delete(3).Success);
        Assert.Equal("Horror Noire", repository.GetAll().Single().Title);
        Assert.Equal(2019, repository.GetByTitle("Horror Noire")!.ReleaseYear);
        Assert.Single(repository.GetUnwatchedOrWatched(true));
        Assert.Single(repository.GetUnwatchedOrWatched(false));
        Assert.Equal(12.5m, repository.GetTime("watched = true"));
        Assert.Equal(12.5m, repository.GetTime("remaining"));

        connection.Rows = [];
        Assert.Empty(repository.GetUnwatchedOrWatched(false));
        connection.Failure = new InvalidOperationException("down");
        Assert.False(repository.Delete(3).Success);
        Assert.Equal(0m, repository.GetTime("watched = true"));
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(0, false)]
    [InlineData(2, false)]
    public void IsSuccessfulResult_TreatsOnlyOneRowAsSuccess(int rows, bool success)
    {
        Assert.Equal(success, DatabaseCommandsHelper.IsSuccessfulResult(rows));
    }

    [Fact]
    public void IsSuccessfulResult_AcceptsNonNullObjectsAndRejectsNulls()
    {
        Assert.True(DatabaseCommandsHelper.IsSuccessfulResult("ok"));
        Assert.False(DatabaseCommandsHelper.IsSuccessfulResult(null));
        Assert.False(DatabaseCommandsHelper.IsSuccessfulResult(DBNull.Value));
        Assert.True(DatabaseCommandsHelper.IsSuccessfulResult(true));
        Assert.False(DatabaseCommandsHelper.IsSuccessfulResult(false));
    }

    [Fact]
    public void RepositoryMessages_CoverEachTemplate()
    {
        Assert.Contains("Halloween", RepositoryMessages.AddSuccess("Halloween"));
        Assert.Contains("Halloween", RepositoryMessages.AddError("Halloween"));
        Assert.Contains("movie", RepositoryMessages.DeleteNotSuccess("movie"));
        Assert.Contains("1", RepositoryMessages.DeleteSuccess("Movie", 1));
        Assert.Contains("1", RepositoryMessages.DeleteError("movie", 1));
        Assert.Contains("movies", RepositoryMessages.GetAllSuccess("movies"));
        Assert.Contains("movies", RepositoryMessages.GetAllError("movies"));
        Assert.Contains("title", RepositoryMessages.GetByTitleSuccess("title"));
        Assert.Contains("title", RepositoryMessages.GetByTitleNotFound("title"));
        Assert.Contains("movie", RepositoryMessages.GetByTitleError("movie"));
        Assert.Contains("movie", RepositoryMessages.UpdateNotSuccess("movie"));
        Assert.Contains("movie", RepositoryMessages.UpdateSuccess("movie"));
        Assert.Contains("movie", RepositoryMessages.UpdateError("movie"));
        Assert.Contains("watched", RepositoryMessages.GetUnwatchedOrWatchedSuccess("watched"));
        Assert.Contains("watched", RepositoryMessages.GetUnwatchedOrWatchedError("watched"));
        Assert.Contains("watched", RepositoryMessages.FetchingTotalTimeError("watched"));
        Assert.Contains("left", RepositoryMessages.FetchingTimeLeftError("left"));
    }
}
