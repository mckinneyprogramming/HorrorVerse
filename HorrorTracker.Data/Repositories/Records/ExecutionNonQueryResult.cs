namespace HorrorTracker.Data.Repositories.Records
{
    /// <summary>
    /// The <see cref="ExecutionNonQueryResult"/> record.
    /// </summary>
    /// <param name="RowsAffected">The RowsAffected.</param>
    /// <param name="Success">The Success.</param>
    /// <param name="Message">The Message.</param>
    public record ExecutionNonQueryResult(int RowsAffected, bool Success, string Message);
}