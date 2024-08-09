using HorrorTracker.Data.Models;
using System.Collections;

namespace HorrorTracker.MSTests.Shared.Comparers
{
    public class DocumentaryComparer : IComparer
    {
        public int Compare(object? x, object? y)
        {
            var documentaryOne = x as Documentary;
            var documentaryTwo = y as Documentary;

            if (documentaryOne == null && documentaryTwo == null) return 0;
            if (documentaryOne == null) return -1;
            if (documentaryTwo == null) return 1;

            int result = documentaryOne.Id.CompareTo(documentaryTwo.Id);
            if (result != 0) return result;

            result = string.Compare(documentaryOne.Title, documentaryTwo.Title, StringComparison.Ordinal);
            if (result != 0) return result;

            result = documentaryOne.TotalTime.CompareTo(documentaryTwo.TotalTime);
            if (result != 0) return result;

            result = documentaryOne.ReleaseYear.CompareTo(documentaryTwo.ReleaseYear);
            if (result != 0) return result;

            return documentaryOne.Watched.CompareTo(documentaryTwo.Watched);
        }
    }
}