using HorrorTracker.Data.Models;
using HorrorTracker.Data.TMDB;
using TMDbLib.Objects.Search;

namespace HorrorTracker.Tests.Data;

public class ModelTests
{
    [Fact]
    public void Models_RoundTripTheirFields()
    {
        var book = new Book("It", 1, 1138, true, 1986, true, 5);
        Assert.Equal(1138, book.Pages);
        Assert.True(book.Read);
        Assert.True(book.PartOfSeries);
        Assert.Equal(1, book.SeriesId);
        Assert.Equal(1986, book.ReleaseYear);

        var series = new BookSeries("It", 2000, 2, false, 6);
        Assert.Equal(2, series.TotalBooks);
        Assert.False(series.Read);

        var show = new Show("The Haunting", 400m, 10, 1, true, 8);
        Assert.Equal(10, show.TotalEpisodes);
        Assert.Equal(1, show.NumberOfSeasons);
        Assert.True(show.Watched);
        Assert.Equal(400m, show.TotalTime);

        var episode = new Episode("The Bent-Neck Lady", 8, new DateTime(2018, 10, 12), 1, 5, true, 50m, 9);
        Assert.Equal(8, episode.ShowId);
        Assert.Equal(1, episode.Season);
        Assert.Equal(5, episode.EpisodeNumber);
        Assert.Equal(new DateTime(2018, 10, 12), episode.ReleaseDate);
    }

    [Fact]
    public void CollectionComparer_MatchesOnId()
    {
        var comparer = new CollectionComparer();
        var left = new SearchCollection { Id = 4, Name = "Halloween" };
        var right = new SearchCollection { Id = 4, Name = "Other" };
        var other = new SearchCollection { Id = 5, Name = "Halloween" };

        Assert.True(comparer.Equals(left, right));
        Assert.False(comparer.Equals(left, other));
        Assert.Equal(comparer.GetHashCode(left), comparer.GetHashCode(right));
    }
}
