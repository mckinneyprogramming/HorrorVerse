using HorrorTracker.Utilities.MathFunctions;

namespace HorrorTracker.MSTests.Utilities.MathFunctions
{
    [TestClass]
    public class SimpleMathFunctionsTests
    {
        [TestMethod]
        [DataRow(new int[] { 1, 2, 3, 4, 5 }, 15)]
        [DataRow(new int[] { 0, 0, 0 }, 0)]
        [DataRow(new int[] { -1, -2, -3 }, -6)]
        public void Add_WhenHavingListOfIntegers_ShouldReturnCorrectSum(int[] numbers, int expectedSum)
        {
            var actualSum = SimpleMathFunctions.Add(numbers);
            Assert.AreEqual(expectedSum, actualSum);
        }

        [TestMethod]
        [DataRow(new double[] { 1.5, 2.5, 3.5 }, 7.5)]
        [DataRow(new double[] { 0.1, 0.2, 0.3 }, 0.6)]
        [DataRow(new double[] { -1.0, -2.0, -3.0 }, -6.0)]
        public void Add_WhenHavingListOfDoubles_ShouldReturnCorrectSum(double[] numbers, double expectedSum)
        {
            var actualSum = SimpleMathFunctions.Add(numbers);
            Assert.AreEqual(expectedSum, actualSum, 0.0001);
        }

        [TestMethod]
        [DataRow(new float[] { 1.5f, 2.5f, 3.5f }, 7.5f)]
        [DataRow(new float[] { 0.1f, 0.2f, 0.3f }, 0.6f)]
        [DataRow(new float[] { -1.0f, -2.0f, -3.0f }, -6.0f)]
        public void Add_WhenHavingListOfFloats_ShouldReturnCorrectSum(float[] numbers, float expectedSum)
        {
            var actualSum = SimpleMathFunctions.Add(numbers);
            Assert.AreEqual(expectedSum, actualSum, 0.0001f);
        }

        [TestMethod]
        [DataRow(new long[] { 10000000000, 20000000000, 30000000000 }, 60000000000)]
        [DataRow(new long[] { 0, 0, 0 }, 0)]
        [DataRow(new long[] { -100, -200, -300 }, -600)]
        public void Add_WhenHavingListOfLongs_ShouldReturnCorrectSum(long[] numbers, long expectedSum)
        {
            var actualSum = SimpleMathFunctions.Add(numbers);
            Assert.AreEqual(expectedSum, actualSum);
        }

        [TestMethod]
        [DataRow(new short[] { 1, 2, 3 }, (short)6)]
        [DataRow(new short[] { 0, 0, 0 }, (short)0)]
        [DataRow(new short[] { -1, -2, -3 }, (short)-6)]
        public void Add_WhenHavingListOfShorts_ShouldReturnCorrectSum(short[] numbers, short expectedSum)
        {
            var actualSum = SimpleMathFunctions.Add(numbers);
            Assert.AreEqual(expectedSum, actualSum);
        }

        [TestMethod]
        [DataRow(new byte[] { 1, 2, 3 }, 6)]
        [DataRow(new byte[] { 0, 0, 0 }, 0)]
        [DataRow(new byte[] { 254, 1 }, 255)]
        public void Add_WhenHavingListOfBytes_ShouldReturnCorrectSum(byte[] numbers, int expectedSum)
        {
            var actualSum = SimpleMathFunctions.Add(numbers);
            Assert.AreEqual(expectedSum, actualSum);
        }

        [TestMethod]
        [DataRow(10, 2, 5)]
        [DataRow(9, 3, 3)]
        [DataRow(-8, 2, -4)]
        public void Divide_WhenDividingTwoIntegers_ShouldReturnCorrectQuotient(int numberOne, int numberTwo, int expectedQuotient)
        {
            var actualQuotient = SimpleMathFunctions.Divide(numberOne, numberTwo);
            Assert.AreEqual(expectedQuotient, actualQuotient);
        }

        [TestMethod]
        [DataRow(7.5, 2.5, 3.0)]
        [DataRow(9.0, 3.0, 3.0)]
        [DataRow(-8.0, 2.0, -4.0)]
        public void Divide_WhenDividingTwoDoubles_ShouldReturnCorrectQuotient(double numberOne, double numberTwo, double expectedQuotient)
        {
            var actualQuotient = SimpleMathFunctions.Divide(numberOne, numberTwo);
            Assert.AreEqual(expectedQuotient, actualQuotient, 0.0001);
        }

        [TestMethod]
        [DataRow(10.0f, 2.0f, 5.0f)]
        [DataRow(9.0f, 3.0f, 3.0f)]
        [DataRow(-8.0f, 2.0f, -4.0f)]
        public void Divide_WhenDividingTwoFloats_ShouldReturnCorrectQuotient(float numberOne, float numberTwo, float expectedQuotient)
        {
            var actualQuotient = SimpleMathFunctions.Divide(numberOne, numberTwo);
            Assert.AreEqual(expectedQuotient, actualQuotient, 0.0001f);
        }

        [TestMethod]
        [DataRow(10L, 2L, 5L)]
        [DataRow(9L, 3L, 3L)]
        [DataRow(-8L, 2L, -4L)]
        public void Divide_WhenDividingTwoLongs_ShouldReturnCorrectQuotient(long numberOne, long numberTwo, long expectedQuotient)
        {
            var actualQuotient = SimpleMathFunctions.Divide(numberOne, numberTwo);
            Assert.AreEqual(expectedQuotient, actualQuotient);
        }

        [TestMethod]
        [DataRow(10, 0)]
        [DataRow(0, 0)]
        public void Divide_WhenDividingByZero_ShouldThrowDivideByZeroException(int numberOne, int numberTwo)
        {
            Assert.ThrowsExactly<DivideByZeroException>(() => SimpleMathFunctions.Divide(numberOne, numberTwo));
        }

        [TestMethod]
        [DataRow(10.0, 0.0)]
        [DataRow(0.0, 0.0)]
        public void Divide_WhenDividingDoubleByZero_ShouldThrowDivideByZeroException(double numberOne, double numberTwo)
        {
            Assert.ThrowsExactly<DivideByZeroException>(() => SimpleMathFunctions.Divide(numberOne, numberTwo));
        }

        [TestMethod]
        [DataRow(10.0f, 0.0f)]
        [DataRow(0.0f, 0.0f)]
        public void Divide_WhenDividingFloatByZero_ShouldThrowDivideByZeroException(float numberOne, float numberTwo)
        {
            Assert.ThrowsExactly<DivideByZeroException>(() => SimpleMathFunctions.Divide(numberOne, numberTwo));
        }

        [TestMethod]
        [DataRow(10L, 0L)]
        [DataRow(0L, 0L)]
        public void Divide_WhenDividingLongByZero_ShouldThrowDivideByZeroException(long numberOne, long numberTwo)
        {
            Assert.ThrowsExactly<DivideByZeroException>(() => SimpleMathFunctions.Divide(numberOne, numberTwo));
        }
    }
}