using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="Movie"/> model base.
    /// </summary>
    /// <seealso cref="VisualBase"/>
    /// <seealso cref="HorrorBase"/>
    public class Movie : VisualBase
    {
        /// <summary>
        /// Gets or sets a value indicating whether the movie is part of a series.
        /// </summary>
        public bool PartOfSeries { get; set; }

        /// <summary>
        /// Gets or sets the SeriesId.
        /// </summary>
        public int? SeriesId { get; set; }

        /// <summary>
        /// Gets or sets the ReleaseYear.
        /// </summary>
        public int ReleaseYear { get; set; }
    }
}