using HorrorTracker.Data.Models.Bases;
using System.Collections.ObjectModel;

namespace HorrorTracker.Data.Constants.Parameters
{
    /// <summary>
    /// The <see cref="HorrorObjectsParameters"/> class.
    /// </summary>
    public static class HorrorObjectsParameters
    {
        /// <summary>
        /// The parameters for inserting into a database.
        /// </summary>
        /// <param name="item">The item.</param>
        /// <returns>The parameters dictionary.</returns>
        public static ReadOnlyDictionary<string, object> InsertParameters(HorrorBase item)
        {
            var parameters = DatabaseParametersHelper.CreateHorrorObjectParameters(item);
            return DatabaseParametersHelper.CreateReadOnlyDictionary(parameters);
        }

        /// <summary>
        /// Retrieves the update parameters.
        /// </summary>
        /// <param name="item">The item.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> UpdateParameters(HorrorBase item)
        {
            var parameters = DatabaseParametersHelper.CreateHorrorObjectParameters(item);
            parameters.Add("Id", item.Id);

            return DatabaseParametersHelper.CreateReadOnlyDictionary(parameters);
        }

        /// <summary>
        /// Retrievs the get by title parameters.
        /// </summary>
        /// <param name="title">The title.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> GetByTitleParameters(string title)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "Title", title }
            });
        }

        /// <summary>
        /// Retrieves the get by id parameters.
        /// </summary>
        /// <param name="id">The id.</param>
        /// <returns>The dictionary of parameters.</returns>
        public static ReadOnlyDictionary<string, object> IdParameters(int id)
        {
            return DatabaseParametersHelper.CreateReadOnlyDictionary(new Dictionary<string, object>
            {
                { "Id", id }
            });
        }
    }
}