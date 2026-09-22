using HorrorTracker.Api.Auth;

namespace HorrorTracker.Tests.Auth;

public class PasswordHasherTests
{
    [Fact]
    public void Hash_ThenVerify_AcceptsTheSamePassword()
    {
        var stored = PasswordHasher.Hash("vault-key");

        Assert.True(PasswordHasher.Verify("vault-key", stored));
    }

    [Fact]
    public void Verify_RejectsADifferentPassword()
    {
        var stored = PasswordHasher.Hash("vault-key");

        Assert.False(PasswordHasher.Verify("wrong-key", stored));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-hash")]
    [InlineData("pbkdf2$sha256$0$c2FsdA==$aGFzaA==")]
    [InlineData("pbkdf2$sha256$100000$%%%$aGFzaA==")]
    public void Verify_RejectsABadStoredValue(string stored)
    {
        Assert.False(PasswordHasher.Verify("vault-key", stored));
    }
}
