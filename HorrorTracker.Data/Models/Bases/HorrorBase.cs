using System.Diagnostics.CodeAnalysis;

namespace HorrorTracker.Data.Models.Bases
{
    /// <summary>
    /// The <see cref="HorrorBase"/> model class.
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class HorrorBase
    {
        /// <summary>
        /// Gets or sets the Id.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Gets or sets the Title.
        /// </summary>
        public string Title { get; set; }
    }
}