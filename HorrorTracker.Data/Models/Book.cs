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
        /// Initializes a new instance of the <see cref="Book"/> class.
        /// </summary>
        /// <param name="title">The title.</param>
        /// <param name="seriesId">The series id.</param>
        /// <param name="pages">The pages.</param>
        /// <param name="partOfSeries">Part of a series.</param>
        /// <param name="releaseYear">The release year.</param>
        /// <param name="read">Read.</param>
        /// <param name="id">The id.</param>
        public Book(string title, int? seriesId, int pages, bool partOfSeries, int releaseYear, bool read, int id = 0)
        {
            Title = title;
            SeriesId = seriesId;
            Pages = pages;
            PartOfSeries = partOfSeries;
            ReleaseYear = releaseYear;
            Read = read;
            Id = id;
        }

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