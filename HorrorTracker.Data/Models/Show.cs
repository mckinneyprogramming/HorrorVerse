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
        /// Gets or sets the TotalEpisodes.
        /// </summary>
        public int TotalEpisodes { get; set; }

        /// <summary>
        /// Gets or sets the NumberOfSeasons.
        /// </summary>
        public int NumberOfSeasons { get; set; }
    }
}