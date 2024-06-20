using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="Documentary"/> model class.
    /// </summary>
    /// <seealso cref="VisualBase"/>
    /// <seealso cref="HorrorBase"/>
    public class Documentary : VisualBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Documentary"/> class.
        /// </summary>
        public Documentary(string title, decimal totalTime, int releaseYear, bool watched, int id = 0)
        {
            Title = title;
            TotalTime = totalTime;
            ReleaseYear = releaseYear;
            Watched = watched;
            Id = id;
        }

        /// <summary>
        /// Gets or sets the ReleaseYear.
        /// </summary>
        public int ReleaseYear { get; set; }
    }
}