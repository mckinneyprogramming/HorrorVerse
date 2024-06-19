using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="Book"/> model class.
    /// </summary>
    /// <seealso cref="BookBase"/>
    /// <seealso cref="HorrorBase"/>
    public class Book : BookBase
    {
        /// <summary>
        /// Gets or sets a value indicating whether the book is part of a book series.
        /// </summary>
        public bool PartOfSeries { get; set; }

        /// <summary>
        /// Gets or sets SeriesId.
        /// </summary>
        public int? SeriesId { get; set; }

        /// <summary>
        /// Gets or sets ReleaseYear.
        /// </summary>
        public int ReleaseYear { get; set; }
    }
}