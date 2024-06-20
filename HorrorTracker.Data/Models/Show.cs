using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="Show"/> model class.
    /// </summary>
    /// <seealso cref="VisualBase"/>
    /// <seealso cref="HorrorBase"/>
    public class Show : VisualBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Show"/> class.
        /// </summary>
        public Show(string title, decimal totalTime, int totalEpisodes, int numberOfSeasons, bool watched, int id = 0)
        {
            Id = id;
            Title = title;
            TotalTime = totalTime;
            TotalEpisodes = totalEpisodes;
            NumberOfSeasons = numberOfSeasons;
            Watched = watched;
        }

        /// <summary>
        /// Gets or sets the TotalEpisodes.
        /// </summary>
        public int TotalEpisodes { get; set; }

        /// <summary>
        /// Gets or sets the NumberOfSeasons.
        /// </summary>
        public int NumberOfSeasons { get; set; }
    }
}