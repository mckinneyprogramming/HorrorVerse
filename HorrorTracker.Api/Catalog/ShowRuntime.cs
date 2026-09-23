using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Api.Catalog;

internal static class ShowRuntime
{
    public static decimal TotalMinutes(TvShow show)
    {
        var episodes = Math.Max(show.NumberOfEpisodes, 0);
        var episodeMinutes = EpisodeMinutes(show);
        return episodeMinutes > 0 && episodes > 0 ? episodeMinutes * episodes : episodeMinutes;
    }

    private static int EpisodeMinutes(TvShow show)
    {
        var listed = show.EpisodeRunTime?.FirstOrDefault(value => value > 0) ?? 0;
        if (listed > 0)
        {
            return listed;
        }

        var last = show.LastEpisodeToAir?.Runtime ?? 0;
        if (last > 0)
        {
            return last;
        }

        return show.NextEpisodeToAir?.Runtime ?? 0;
    }
}
