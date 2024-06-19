using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.Models.Bases
{
    /// <summary>
    /// The <see cref="BookBase"/> model class.
    /// </summary>
    /// <seealso cref="HorrorBase"/>
    [ExcludeFromCodeCoverage]
    public class BookBase : HorrorBase
    {
        /// <summary>
        /// Gets or sets the number of pages.
        /// </summary>
        public int Pages { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the book is read or book series is read.
        /// </summary>
        public bool Read { get; set; }
    }
}