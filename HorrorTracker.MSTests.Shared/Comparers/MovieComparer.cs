using HorrorTracker.Data.Models;
using System.Collections;

namespace HorrorTracker.MSTests.Shared.Comparers
{
    public class MovieComparer : IComparer
    {
        public int Compare(object? x, object? y)
        {
            var movieOne = x as Movie;
            var movieTwo = y as Movie;

            if (movieOne == null && movieTwo == null) return 0;
            if (movieOne == null) return -1;
            if (movieTwo == null) return 1;

            int result = movieOne.Id.CompareTo(movieTwo.Id);
            if (result != 0) return result;

            result = string.Compare(movieOne.Title, movieTwo.Title, StringComparison.Ordinal);
            if (result != 0) return result;

            result = movieOne.TotalTime.CompareTo(movieTwo.TotalTime);
            if (result != 0) return result;

            result = movieOne.PartOfSeries.CompareTo(movieTwo.PartOfSeries);
            if (result != 0) return result;

            result = movieOne.SeriesId.Value.CompareTo(movieTwo.SeriesId.Value);
            if (result != 0) return result;

            result = movieOne.ReleaseYear.CompareTo(movieTwo.ReleaseYear);
            if (result != 0) return result;

            return movieOne.Watched.CompareTo(movieTwo.Watched);
        }
    }
}