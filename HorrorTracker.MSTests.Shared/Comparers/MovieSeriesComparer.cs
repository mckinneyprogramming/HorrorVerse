using HorrorTracker.Data.Models;
using System.Collections;

namespace HorrorTracker.MSTests.Shared.Comparers
{
    public class MovieSeriesComparer : IComparer
    {
        public int Compare(object? x, object? y)
        {
            var seriesX = x as MovieSeries;
            var seriesY = y as MovieSeries;

            if (seriesX == null && seriesY == null) return 0;
            if (seriesX == null) return -1;
            if (seriesY == null) return 1;

            int result = seriesX.Id.CompareTo(seriesY.Id);
            if (result != 0) return result;

            result = string.Compare(seriesX.Title, seriesY.Title, StringComparison.Ordinal);
            if (result != 0) return result;

            result = seriesX.TotalTime.CompareTo(seriesY.TotalTime);
            if (result != 0) return result;

            result = seriesX.TotalMovies.CompareTo(seriesY.TotalMovies);
            if (result != 0) return result;

            return seriesX.Watched.CompareTo(seriesY.Watched);
        }
    }
}
