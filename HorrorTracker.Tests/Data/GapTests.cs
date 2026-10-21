using HorrorTracker.Data.Constants.Parameters;
using HorrorTracker.Data.Helpers;
using HorrorTracker.Data.Models;
using HorrorTracker.Data.Repositories;
using HorrorTracker.Data.TMDB;

namespace HorrorTracker.Tests.Data;

public class GapTests
{
    [Fact]
    public async Task MovieDatabaseService_ForwardsEveryCall()
    {
        var script = new HorrorTracker.Tests.Api.ScriptedTmdb();
        script.MovieSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<TMDbLib.Objects.Search.SearchMovie>());
        script.ShowSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<TMDbLib.Objects.Search.SearchTv>());
        script.CollectionSearches.Enqueue(new TMDbLib.Objects.General.SearchContainer<TMDbLib.Objects.Search.SearchCollection>());
        var service = script.Service;

        Assert.NotNull(await service.SearchMovie("Halloween"));
        Assert.NotNull(await service.SearchTvShow("Chapelwaite"));
        Assert.NotNull(await service.SearchCollection("Halloween"));
        Assert.Equal(4, (await service.GetMovie(4)).Id);
        Assert.Equal(5, (await service.GetCollection(5)).Id);
        Assert.Equal(6, (await service.GetTvShow(6)).Id);
        Assert.Equal(2, (await service.GetTvSeason(6, 2)).SeasonNumber);
        Assert.Equal(3, (await service.GetTvEpisode(6, 2, 3)).EpisodeNumber);
        Assert.Contains(await service.GetHorrorCollections(1, 2, 27), item => item.Id == 27);
        Assert.Equal(27, await service.GetNumberOfPages(27));
        Assert.Equal("Soon", (await service.GetUpcomingHorrorMovies()).Single().Title);
        Assert.NotNull(await service.GetLists());
    }

    [Fact]
    public void ParameterHelper_CoversEachHorrorShape()
    {
        var movie = DatabaseParametersHelper.CreateHorrorObjectParameters(new Movie("A", 1m, true, 4, 1978, true));
        Assert.Equal(4, movie["SeriesId"]);
        var alone = DatabaseParametersHelper.CreateHorrorObjectParameters(new Movie("B", 1m, false, null, 1980, false));
        Assert.Equal(DBNull.Value, alone["SeriesId"]);
        var series = DatabaseParametersHelper.CreateHorrorObjectParameters(new MovieSeries("C", 2m, 3, false));
        Assert.Equal(3, series["TotalMovies"]);
        var documentary = DatabaseParametersHelper.CreateHorrorObjectParameters(new Documentary("D", 3m, 2019, true));
        Assert.Equal(2019, documentary["ReleaseYear"]);
        var book = new Book("E", null, 10, false, 1990, false);
        Assert.Single(DatabaseParametersHelper.CreateHorrorObjectParameters(book));
        Assert.Equal("E", HorrorObjectsParameters.InsertParameters(book)["Title"]);
        Assert.Equal(0, HorrorObjectsParameters.UpdateParameters(book)["Id"]);
    }

    [Fact]
    public void Repositories_CoverRemainingFailureBranches()
    {
        var movies = new FakeConnection { Failure = new InvalidOperationException("down") };
        var movieRepository = new MovieRepository(movies, new RecordingLogger());
        Assert.Empty(movieRepository.GetUnwatchedOrWatchedMoviesInSeries(true, "Halloween"));
        Assert.Empty(movieRepository.GetUnwatchedOrWatchedMoviesInSeries(false, "Halloween"));
        Assert.Empty(movieRepository.GetUnwatchedOrWatched(true));

        var seriesConnection = new FakeConnection { Rows = [] };
        var series = new MovieSeriesRepository(seriesConnection, new RecordingLogger());
        Assert.Null(series.GetByTitle("missing"));
        seriesConnection.Failure = new InvalidOperationException("down");
        Assert.Equal(0m, series.GetTimeLeft(4));
        Assert.False(series.UpdateTotalMovies(4).Success);
        Assert.False(series.UpdateWatched(4).Success);

        var documentaries = new FakeConnection { Rows = [] };
        var documentaryRepository = new DocumentaryRepository(documentaries, new RecordingLogger());
        Assert.Null(documentaryRepository.GetByTitle("missing"));
        Assert.Empty(documentaryRepository.GetAll());
        documentaries.Failure = new InvalidOperationException("down");
        Assert.False(documentaryRepository.Update(new Documentary("Horror Noire", 1m, 2019, false)).Success);
        Assert.Empty(documentaryRepository.GetUnwatchedOrWatched(false));
        documentaries.Failure = null;
        Assert.Empty(documentaryRepository.GetUnwatchedOrWatched(true));
        Assert.Equal(12.5m, documentaryRepository.GetTime("SELECT SUM(totaltime) FROM documentary WHERE watched = true"));
        Assert.Equal(12.5m, documentaryRepository.GetTime("SELECT SUM(totaltime) FROM documentary WHERE watched = false"));
        documentaries.NonQueryResult = 0;
        Assert.False(documentaryRepository.Delete(4).Success);
        documentaries.NonQueryResult = 1;
        Assert.True(documentaryRepository.Delete(4).Success);

        var helper = new DatabaseConnectionsHelper(new FakeConnection());
        helper.Open();
        helper.Close();
        var commands = new FakeConnection();
        Assert.Equal(12.5m, DatabaseCommandsHelper.ExecutesScalar(commands, "select 1"));
        Assert.NotNull(DatabaseCommandsHelper.ExecutesReader(commands, "select 1", DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object> { ["Id"] = 1 })));
        Assert.Equal(1, DatabaseCommandsHelper.ExecuteNonQuery(commands, "update", null));
    }
}
