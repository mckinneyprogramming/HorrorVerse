using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.Models.Bases
{
    /// <summary>
    /// The <see cref="VisualBase"/> model class.
    /// </summary>
    /// <seealso cref="HorrorBase"/>
    [ExcludeFromCodeCoverage]
    public class VisualBase : HorrorBase
    {
        /// <summary>
        /// Gets or sets a value indicating whether the item was watched.
        /// </summary>
        public bool Watched { get; set; }

        /// <summary>
        /// Gets or sets the TotalTime.
        /// </summary>
        public decimal TotalTime { get; set; }
    }
}