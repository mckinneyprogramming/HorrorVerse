using HorrorTracker.Utilities.Helpers;

namespace HorrorTracker.Tests.Utilities;

public class StringHelperTests
{
    [Theory]
    [InlineData("yes")]
    [InlineData("Y")]
    [InlineData(" true ")]
    [InlineData("yeah")]
    public void IsAffirmative_AcceptsKnownYesValues(string input)
    {
        Assert.True(StringHelper.IsAffirmative(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no")]
    [InlineData("maybe")]
    public void IsAffirmative_RejectsEverythingElse(string? input)
    {
        Assert.False(StringHelper.IsAffirmative(input));
    }

    [Fact]
    public void StringIsNull_TreatsBlankAsEmpty()
    {
        Assert.True(StringHelper.StringIsNull(null));
        Assert.True(StringHelper.StringIsNull("   "));
        Assert.False(StringHelper.StringIsNull("vault"));
    }
}
