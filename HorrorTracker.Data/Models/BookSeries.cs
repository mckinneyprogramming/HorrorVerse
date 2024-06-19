using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="BookSeries"/> model class.
    /// </summary>
    /// <seealso cref="BookBase"/>
    /// <seealso cref="HorrorBase"/>
    public class BookSeries : BookBase
    {
        /// <summary>
        /// Gets or sets the TotalBooks.
        /// </summary>
        public int TotalBooks { get; set; }
    }
}