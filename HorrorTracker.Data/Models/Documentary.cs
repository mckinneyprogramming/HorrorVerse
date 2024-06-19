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
        /// Gets or sets the ReleaseYear.
        /// </summary>
        public int ReleaseYear { get; set; }
    }
}