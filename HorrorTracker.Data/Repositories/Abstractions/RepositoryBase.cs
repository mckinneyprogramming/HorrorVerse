using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Repositories.Abstractions
{
    /// <summary>
    /// The <see cref="RepositoryBase{T}"/> class.
    /// </summary>
    /// <typeparam name="T">The horror object.</typeparam>
    public abstract class RepositoryBase<T> where T : HorrorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="RepositoryBase{T}"/> class.
        /// </summary>
        protected RepositoryBase() { }

        /// <summary>
        /// Add an item to the database.
        /// </summary>
        /// <param name="entity">The horror object.</param>
        /// <returns></returns>
        public abstract int Add(T entity);

        /// <summary>
        /// Deletes an item in the database.
        /// </summary>
        /// <param name="id">The id.</param>
        /// <returns>the message.</returns>
        public abstract string Delete(int id);

        /// <summary>
        /// Retrieves all the items from the database.
        /// </summary>
        /// <returns>The list/array of items.</returns>
        public abstract IEnumerable<T> GetAll();

        /// <summary>
        /// Retrieves the item from the database by the title.
        /// </summary>
        /// <param name="name">The title of the object.</param>
        /// <returns>The item.</returns>
        public abstract T? GetByTitle(string title);

        /// <summary>
        /// Retrieves all the items that are unwatched or watched.
        /// </summary>
        /// <param name="name">The title of the object.</param>
        /// <param name="query">The query.</param>
        /// <returns>The list/array of items.</returns>
        public abstract IEnumerable<T> GetUnwatchedOrWatchedByName(string name, string query);

        /// <summary>
        /// Updates an item in the database.
        /// </summary>
        /// <param name="entity">The horror object.</param>
        /// <returns>The message.</returns>
        public abstract string Update(T entity);
    }
}