namespace HorrorTracker.Utilities.Extenions
{
    /// <summary>
    /// The <see cref="CollectionExtensions"/> class.
    /// </summary>
    public static class CollectionExtensions
    {
        /// <summary>
        /// Resets the collection and fills it with new items.
        /// </summary>
        /// <typeparam name="T">The object type.</typeparam>
        /// <param name="collection">The initial collection.</param>
        /// <param name="newItems">The new items for the collection.</param>
        public static void ResetAndFill<T>(this ICollection<T> collection, IEnumerable<T> newItems)
        {
            collection.Clear();
            foreach (var item in newItems)
            {
                collection.Add(item);
            }
        }
    }
}