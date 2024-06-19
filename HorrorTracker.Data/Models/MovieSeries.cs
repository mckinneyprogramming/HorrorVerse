using HorrorTracker.Data.Models.Bases;

namespace HorrorTracker.Data.Models
{
    /// <summary>
    /// The <see cref="MovieSeries"/> model class.
    /// </summary>
    /// <seealso cref="VisualBase"/>
    /// <seealso cref="HorrorBase"/>
    public class MovieSeries : VisualBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="MovieSeries"/> class.
        /// </summary>
        /// <param name="title">The title.</param>
        /// <param name="totalTime">The total time.</param>
        /// <param name="totalMovies">The total movies.</param>
        /// <param name="watched">Watched.</param>
        /// <param name="id">The id.</param>
        public MovieSeries(string title, int totalTime, int totalMovies, bool watched, int id = 0)
        {
            Id = id;
            Title = title;
            TotalTime = totalTime;
            TotalMovies = totalMovies;
            Watched = watched;
        }

        /// <summary>
        /// Gets or sets the TotalMovies.
        /// </summary>
        public int TotalMovies { get; set; }
    }
}