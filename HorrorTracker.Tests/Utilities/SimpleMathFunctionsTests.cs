using HorrorTracker.Utilities.MathFunctions;

namespace HorrorTracker.Tests.Utilities;

public class SimpleMathFunctionsTests
{
    [Fact]
    public void Add_SumsEveryValue()
    {
        Assert.Equal(6, SimpleMathFunctions.Add(1, 2, 3));
        Assert.Equal(0, SimpleMathFunctions.Add<int>());
    }

    [Fact]
    public void Divide_DividesTheFirstByTheSecond()
    {
        Assert.Equal(4, SimpleMathFunctions.Divide(20, 5));
    }

    [Fact]
    public void Divide_ThrowsWhenTheDivisorIsZero()
    {
        Assert.Throws<DivideByZeroException>(() => SimpleMathFunctions.Divide(10, 0));
    }

    [Fact]
    public void ConvertToHours_DividesMinutesBySixty()
    {
        Assert.Equal(2, SimpleMathFunctions.ConvertToHours(120));
    }

    [Fact]
    public void ConvertToDays_DividesMinutesByADay()
    {
        Assert.Equal(1, SimpleMathFunctions.ConvertToDays(1440));
    }
}
