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
    [InlineData("pbkdf2$sha256$nope$c2FsdA==$aGFzaA==")]
    [InlineData("other$sha256$100000$c2FsdA==$YQ==")]
    [InlineData("pbkdf2$md5$100000$c2FsdA==$YQ==")]
    [InlineData("pbkdf2$sha256$100000$%%%$aGFzaA==")]
    [InlineData("pbkdf2$sha256$100000$c2FsdA==$%%%")]
    public void Verify_RejectsABadStoredValue(string stored)
    {
        Assert.False(PasswordHasher.Verify("vault-key", stored));
    }

    [Fact]
    public void Verify_RejectsADifferentHashLength()
    {
        Assert.False(PasswordHasher.Verify("vault-key", "pbkdf2$sha256$100000$c2FsdA==$YQ=="));
    }

    [Fact]
    public void HashWithSalt_MatchesTheSharedWebVector()
    {
        const string stored = "pbkdf2$sha256$100000$MDEyMzQ1Njc4OWFiY2RlZg==$PZgVM8/wnN/TkpBKX6T0lPFq64b4g9JL7OZaXNAQFlU=";

        Assert.Equal(stored, PasswordHasher.HashWithSalt("vault-key", "0123456789abcdef"u8.ToArray()));
        Assert.True(PasswordHasher.Verify("vault-key", stored));
        Assert.False(PasswordHasher.Verify("other-key", stored));
    }
}
