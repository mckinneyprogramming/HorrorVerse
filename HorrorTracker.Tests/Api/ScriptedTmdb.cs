using HorrorTracker.Data.TMDB;
using HorrorTracker.Data.TMDB.Interfaces;
using TMDbLib.Objects.Collections;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Lists;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace HorrorTracker.Tests.Api;

internal sealed class ScriptedTmdb : ITMDbClientWrapper
{
    public Queue<SearchContainer<SearchMovie>> MovieSearches { get; } = new();
    public Queue<SearchContainer<SearchTv>> ShowSearches { get; } = new();
    public Queue<SearchContainer<SearchCollection>> CollectionSearches { get; } = new();
    public Dictionary<int, Movie> Movies { get; } = [];
    public Dictionary<int, Collection> Collections { get; } = [];
    public Dictionary<int, TvShow> Shows { get; } = [];
    public Dictionary<(int ShowId, int Season), TvSeason> Seasons { get; } = [];
    public HashSet<int> FailCollections { get; } = [];
    public HashSet<int> FailMovies { get; } = [];
    public HashSet<int> FailShows { get; } = [];
    public HashSet<int> FailSeasons { get; } = [];
    public bool ThrowCollectionSearch { get; set; }
    public bool ThrowShowSearch { get; set; }
    public TimeSpan MovieDelay { get; set; }
    public int MovieDelayUses { get; set; }
    public List<string> MovieQueries { get; } = [];
    public List<string> ShowQueries { get; } = [];
    public List<string> CollectionQueries { get; } = [];

    public MovieDatabaseService Service => new(this);

    public Task<SearchContainer<SearchCollection>> SearchCollectionAsync(string query, int page = 0, CancellationToken cancellationToken = default)
    {
        CollectionQueries.Add(query);
        if (ThrowCollectionSearch)
        {
            throw new InvalidOperationException("collection search down");
        }

        return Task.FromResult(CollectionSearches.Count > 0
            ? CollectionSearches.Dequeue()
            : new SearchContainer<SearchCollection> { Results = [] });
    }

    public Task<SearchContainer<SearchMovie>> SearchMovieAsync(
        string movie,
        int page = 0,
        bool includeAdult = false,
        int year = 0,
        string? region = default,
        int primaryReleaseYear = 0,
        CancellationToken cancellationToken = default)
    {
        MovieQueries.Add(movie);
        return Task.FromResult(MovieSearches.Count > 0
            ? MovieSearches.Dequeue()
            : new SearchContainer<SearchMovie> { Results = [] });
    }

    public Task<SearchContainer<SearchTv>> SearchTvShowAsync(
        string tvShowName,
        int page = 0,
        bool includeAdult = false,
        int firstAirDateYear = 0,
        CancellationToken cancellationToken = default)
    {
        ShowQueries.Add(tvShowName);
        if (ThrowShowSearch)
        {
            throw new InvalidOperationException("show search down");
        }

        return Task.FromResult(ShowSearches.Count > 0
            ? ShowSearches.Dequeue()
            : new SearchContainer<SearchTv> { Results = [] });
    }

    public Task<Collection> GetCollectionAsync(int collectionId, CollectionMethods methods = CollectionMethods.Images, CancellationToken cancellationToken = default)
    {
        if (FailCollections.Contains(collectionId))
        {
            throw new InvalidOperationException("collection down");
        }

        return Task.FromResult(Collections.TryGetValue(collectionId, out var collection)
            ? collection
            : new Collection { Id = collectionId, Name = "Missing Collection", Parts = [] });
    }

    public Task<Movie> GetMovieAsync(int movieId, MovieMethods appendToResponse = MovieMethods.Undefined, CancellationToken cancellationToken = default)
    {
        if (FailMovies.Contains(movieId))
        {
            throw new InvalidOperationException("movie down");
        }

        if (MovieDelayUses > 0)
        {
            MovieDelayUses--;
            Thread.Sleep(MovieDelay);
        }

        return Task.FromResult(Movies.TryGetValue(movieId, out var movie)
            ? movie
            : new Movie { Id = movieId, Title = "Untitled", Runtime = 90, ReleaseDate = new DateTime(1980, 1, 1) });
    }

    public Task<TvShow> GetTvShowAsync(
        int tvShowId,
        TvShowMethods tvShowMethods = TvShowMethods.Undefined,
        string? language = null,
        string? includeImageLanguage = null,
        CancellationToken cancellationToken = default)
    {
        if (FailShows.Contains(tvShowId))
        {
            throw new InvalidOperationException("show down");
        }

        return Task.FromResult(Shows.TryGetValue(tvShowId, out var show)
            ? show
            : new TvShow { Id = tvShowId, Name = "Untitled Show", NumberOfEpisodes = 1, NumberOfSeasons = 1 });
    }

    public Task<TvSeason> GetTvSeasonAsync(
        int tvShowId,
        int seasonNumber,
        TvSeasonMethods tvSeasonMethods = TvSeasonMethods.Undefined,
        string? language = null,
        string? includeImageLanguage = null,
        CancellationToken cancellationToken = default)
    {
        if (FailSeasons.Contains(seasonNumber))
        {
            throw new InvalidOperationException("season down");
        }

        return Task.FromResult(Seasons.TryGetValue((tvShowId, seasonNumber), out var season)
            ? season
            : new TvSeason { SeasonNumber = seasonNumber, Episodes = [] });
    }

    public Task<TvEpisode> GetTvEpisodeAsync(
        int tvShowId,
        int seasonNumber,
        int episodeNumber,
        TvEpisodeMethods tvEpisodeMethods = TvEpisodeMethods.Undefined,
        string? language = null,
        string? includeImageLanguage = null,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(new TvEpisode { EpisodeNumber = episodeNumber, SeasonNumber = seasonNumber, Name = "Episode", Runtime = 40 });

    public Task<HashSet<SearchCollection>> GetHorrorCollections(int startPage, int endPage, int genreId) =>
        Task.FromResult(new HashSet<SearchCollection>(new CollectionComparer()) { new SearchCollection { Id = genreId, Name = "Horror" } });

    public Task<int> GetNumberOfPages(int genreId) => Task.FromResult(genreId);

    public Task<List<SearchMovie>> GetUpcomingHorrorMoviesAsync() =>
        Task.FromResult(new List<SearchMovie> { new() { Id = 9, Title = "Soon" } });

    public Task<SearchContainer<AccountList>> GetLists() =>
        Task.FromResult(new SearchContainer<AccountList> { Results = [] });
}
