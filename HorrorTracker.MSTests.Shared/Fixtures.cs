using AutoFixture;
using HorrorTracker.Data.Models;
using System.Diagnostics.CodeAnalysis;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Lists;
using TMDbLib.Objects.Search;

namespace HorrorTracker.MSTests.Shared
{
    /// <summary>
    /// The <see cref="Fixtures"/> class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public static class Fixtures
    {
        /// <summary>
        /// The fixture.
        /// </summary>
        private static readonly Fixture? _fixture = new();

        /// <summary>
        /// Movie series created from the fixture.
        /// </summary>
        /// <returns>The movie series.</returns>
        public static MovieSeries MovieSeries()
        {
            return _fixture.Create<MovieSeries>();
        }

        /// <summary>
        /// Movie created from the fixture.
        /// </summary>
        /// <returns>The movie.</returns>
        public static Movie Movie()
        {
            return _fixture.Create<Movie>();
        }

        /// <summary>
        /// Search collection created from the fixture.
        /// </summary>
        /// <returns>The search collection.</returns>
        public static SearchCollection SearchCollection()
        {
            return _fixture.Create<SearchCollection>();
        }

        /// <summary>
        /// Many search movie created from the fixture.
        /// </summary>
        /// <returns>The list of search movie.</returns>
        public static IEnumerable<SearchMovie> ManySearchMovie()
        {
            return _fixture.CreateMany<SearchMovie>();
        }

        /// <summary>
        /// Account list search container created from the fixture.
        /// </summary>
        /// <returns>The account list search container.</returns>
        public static SearchContainer<AccountList> AccountListSearchContainer()
        {
            return _fixture.Create<SearchContainer<AccountList>>();
        }
    }
}