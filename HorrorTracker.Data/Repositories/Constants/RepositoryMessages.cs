namespace HorrorTracker.Data.Repositories.Constants
{
    /// <summary>
    /// The <see cref="RepositoryMessages"/> class.
    /// </summary>
    public static class RepositoryMessages
    {
        /// <summary>
        /// The success message for adding an item.
        /// </summary>
        /// <param name="itemTitle">The items title.</param>
        /// <returns>The message.</returns>
        public static string AddSuccess(string itemTitle)
        {
            return $"{itemTitle} was added successfully.";
        }

        /// <summary>
        /// The error message for adding an item.
        /// </summary>
        /// <param name="itemTitle">The items title.</param>
        /// <returns>The message.</returns>
        public static string AddError(string itemTitle)
        {
            return $"Error adding {itemTitle}.";
        }

        /// <summary>
        /// The not success message for deleting an item.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string DeleteNotSuccess(string repositoryName)
        {
            return $"Deleting {repositoryName} was not successful.";
        }

        /// <summary>
        /// The success message for deleting an item.
        /// </summary>
        /// <param name="repositoryName">the repository name.</param>
        /// <param name="id">The id.</param>
        /// <returns>The message.</returns>
        public static string DeleteSuccess(string repositoryName, int id)
        {
            return $"{repositoryName} with ID '{id}' deleted successfully.";
        }

        /// <summary>
        /// The error message for deleting an item.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <param name="id">The id.</param>
        /// <returns>The message.</returns>
        public static string DeleteError(string repositoryName, int id)
        {
            return $"Error deleting {repositoryName} with ID '{id}'.";
        }

        /// <summary>
        /// The success message for getting all items.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string GetAllSuccess(string repositoryName)
        {
            return $"Successfully retrieved all of the {repositoryName}.";
        }

        /// <summary>
        /// The error message for getting all items.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string GetAllError(string repositoryName)
        {
            return $"Error fetching all of the {repositoryName}.";
        }

        /// <summary>
        /// The success message for getting an item by title.
        /// </summary>
        /// <param name="repoAndTitleName">The repository and title.</param>
        /// <returns>The message.</returns>
        public static string GetByTitleSuccess(string repoAndTitleName)
        {
            return $"{repoAndTitleName} was found in the database.";
        }

        /// <summary>
        /// The not found message for getting an itme by title.
        /// </summary>
        /// <param name="repoAndTitleName">The repository and title.</param>
        /// <returns>The message.</returns>
        public static string GetByTitleNotFound(string repoAndTitleName)
        {
            return $"{repoAndTitleName} not found in the database.";
        }

        /// <summary>
        /// The error message for getting an item by title.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string GetByTitleError(string repositoryName)
        {
            return $"An error occurred while getting the {repositoryName} by name.";
        }

        /// <summary>
        /// The not successful message for updating an item.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string UpdateNotSuccess(string repositoryName)
        {
            return $"Updating {repositoryName} was not successful.";
        }

        /// <summary>
        /// The success message for updating an item.
        /// </summary>
        /// <param name="repoAndTitleName">The repository and title.</param>
        /// <returns>The message.</returns>
        public static string UpdateSuccess(string repoAndTitleName)
        {
            return $"{repoAndTitleName} updated successfully.";
        }

        /// <summary>
        /// The error message for updating an item.
        /// </summary>
        /// <param name="repoAndTitleName">The repository and title.</param>
        /// <returns>The message.</returns>
        public static string UpdateError(string repoAndTitleName)
        {
            return $"Error updating {repoAndTitleName}.";
        }

        /// <summary>
        /// The success message for unwatched or watched items.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string GetUnwatchedOrWatchedSuccess(string repositoryName)
        {
            return $"Successfully retrieved list of {repositoryName}.";
        }

        /// <summary>
        /// The error message for unwatched or watched items.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string GetUnwatchedOrWatchedError(string repositoryName)
        {
            return $"Error fetching {repositoryName}.";
        }

        /// <summary>
        /// The error message for fetching the total time.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string FetchingTotalTimeError(string repositoryName)
        {
            return $"Error fetching total time of {repositoryName}.";
        }

        /// <summary>
        /// The error message for fetching time left.
        /// </summary>
        /// <param name="repositoryName">The repository name.</param>
        /// <returns>The message.</returns>
        public static string FetchingTimeLeftError(string repositoryName)
        {
            return $"Error fetching time left of {repositoryName}.";
        }
    }
}