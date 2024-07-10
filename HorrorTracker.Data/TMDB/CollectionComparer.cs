using TMDbLib.Objects.Search;

namespace HorrorTracker.Data.TMDB
{
    public class CollectionComparer : IEqualityComparer<SearchCollection>
    {
        /// <summary>
        /// Compares two search collections.
        /// </summary>
        /// <param name="x">First serach collection.</param>
        /// <param name="y">Seacond search collection.</param>
        /// <returns>True if the search collections are equal; false otherwise.</returns>
#pragma warning disable CS8767 // Nullability of reference types in type of parameter doesn't match implicitly implemented member (possibly because of nullability attributes).
        public bool Equals(SearchCollection x, SearchCollection y)
#pragma warning restore CS8767 // Nullability of reference types in type of parameter doesn't match implicitly implemented member (possibly because of nullability attributes).
        {
            return x.Id == y.Id;
        }

        /// <summary>
        /// Retrieves the hash code for the search collection.
        /// </summary>
        /// <param name="obj">The search collection.</param>
        /// <returns>The hash code.</returns>
        public int GetHashCode(SearchCollection obj)
        {
            return obj.Id.GetHashCode();
        }
    }
}