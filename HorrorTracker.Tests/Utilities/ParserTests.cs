using HorrorTracker.Utilities.Parsing;

namespace HorrorTracker.Tests.Utilities;

public class ParserTests
{
    private readonly Parser _parser = new();

    [Theory]
    [InlineData("12", true, 12)]
    [InlineData("0", true, 0)]
    [InlineData("-4", true, -4)]
    [InlineData("nope", false, 0)]
    [InlineData("", false, 0)]
    [InlineData(null, false, 0)]
    public void IsInteger_ParsesWholeNumbers(string? value, bool expected, int parsed)
    {
        var ok = _parser.IsInteger(value, out var integer);

        Assert.Equal(expected, ok);
        Assert.Equal(parsed, integer);
    }

    [Fact]
    public void IsDecimal_AcceptsDecimalAndNumericStrings()
    {
        Assert.True(_parser.IsDecimal(1.5m, out var fromDecimal));
        Assert.Equal(1.5m, fromDecimal);

        Assert.True(_parser.IsDecimal("2.25", out var fromString));
        Assert.Equal(2.25m, fromString);
    }

    [Fact]
    public void IsDecimal_RejectsNonNumericInput()
    {
        Assert.False(_parser.IsDecimal(true, out var result));
        Assert.Equal(0m, result);
    }
}
