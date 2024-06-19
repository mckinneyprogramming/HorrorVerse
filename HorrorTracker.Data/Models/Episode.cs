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