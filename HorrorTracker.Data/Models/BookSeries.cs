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
        /// Initializes a new instance of the <see cref="BookSeries"/> class.
        /// </summary>
        /// <param name="title">The title.</param>
        /// <param name="pages">The pages.</param>
        /// <param name="totalBooks">The total number of books.</param>
        /// <param name="read">Read.</param>
        /// <param name="id">The id.</param>
        public BookSeries(string title, int pages, int totalBooks, bool read, int id = 0)
        {
            Title = title;
            Pages = pages;
            TotalBooks = totalBooks;
            Read = read;
            Id = id;
        }

        /// <summary>
        /// Gets or sets the TotalBooks.
        /// </summary>
        public int TotalBooks { get; set; }
    }
}