using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="Episode"/> model class.
    /// </summary>
    /// <seealso cref="VisualBase"/>
    /// <seealso cref="HorrorBase"/>
    public class Episode : VisualBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Episode"/> class.
        /// </summary>
        public Episode(
            string title,
            int showId,
            DateTime releaseDate,
            int season,
            int episodeNumber,
            bool watched,
            decimal totalTime,
            int id = 0)
        {
            Title = title;
            ShowId = showId;
            ReleaseDate = releaseDate;
            Season = season;
            EpisodeNumber = episodeNumber;
            Watched = watched;
            TotalTime = totalTime;
            Id = id;
        }

        /// <summary>
        /// Gets or sets the ShowId.
        /// </summary>
        public int ShowId { get; set; }

        /// <summary>
        /// Gets or sets the ReleaseDate.
        /// </summary>
        public DateTime ReleaseDate { get; set; }

        /// <summary>
        /// Gets or sets the Season.
        /// </summary>
        public int Season { get; set; }

        /// <summary>
        /// Gets or sets the EpisodeNumber.
        /// </summary>
        public int EpisodeNumber { get; set; }
    }
}