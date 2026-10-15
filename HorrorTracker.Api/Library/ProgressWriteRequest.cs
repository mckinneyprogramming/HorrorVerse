namespace HorrorTracker.Api.Library;

public sealed class ProgressWriteRequest
{
    public string? Id { get; set; }
    public bool Completed { get; set; }
    public bool Dated { get; set; } = true;
    public int? Year { get; set; }
}
