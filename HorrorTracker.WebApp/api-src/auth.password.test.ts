import { describe, expect, it } from "vitest";
import { hashPassword, hashPasswordWithSalt, verifyPassword } from "./auth";

const sharedVector = "pbkdf2$sha256$100000$MDEyMzQ1Njc4OWFiY2RlZg==$PZgVM8/wnN/TkpBKX6T0lPFq64b4g9JL7OZaXNAQFlU=";

describe("password hashing", () => {
  it("matches the shared C# vector and rejects a different password", async () => {
    const salt = new TextEncoder().encode("0123456789abcdef");
    await expect(hashPasswordWithSalt("vault-key", salt)).resolves.toBe(sharedVector);
    await expect(verifyPassword("vault-key", sharedVector)).resolves.toBe(true);
    await expect(verifyPassword("other-key", sharedVector)).resolves.toBe(false);
  });

  it("hashes a random salt that verifies", async () => {
    const stored = await hashPassword("vault-key");
    await expect(verifyPassword("vault-key", stored)).resolves.toBe(true);
  });

  it.each(["", "not-a-hash", "other$sha256$100000$c2FsdA==$YQ==", "pbkdf2$md5$100000$c2FsdA==$YQ==", "pbkdf2$sha256$0$c2FsdA==$YQ==", "pbkdf2$sha256$nope$c2FsdA==$YQ==", "pbkdf2$sha256$100000$%%%$YQ==", "pbkdf2$sha256$100000$c2FsdA==$YQ=="])(
    "rejects %s",
    async (stored) => {
      await expect(verifyPassword("vault-key", stored)).resolves.toBe(false);
    },
  );

  it("rejects a valid hash whose label, algorithm, or part count was changed", async () => {
    const [, , iterations, salt, hash] = sharedVector.split("$");
    await expect(verifyPassword("vault-key", `scrypt$sha256$${iterations}$${salt}$${hash}`)).resolves.toBe(false);
    await expect(verifyPassword("vault-key", `pbkdf2$sha1$${iterations}$${salt}$${hash}`)).resolves.toBe(false);
    await expect(verifyPassword("vault-key", `${sharedVector}$extra`)).resolves.toBe(false);
  });

  it("accepts a hash that used a single iteration", async () => {
    const salt = new TextEncoder().encode("0123456789abcdef");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("vault-key"), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 1 }, key, 256);
    const stored = `pbkdf2$sha256$1$${Buffer.from(salt).toString("base64")}$${Buffer.from(new Uint8Array(bits)).toString("base64")}`;
    await expect(verifyPassword("vault-key", stored)).resolves.toBe(true);
    await expect(verifyPassword("other-key", stored)).resolves.toBe(false);
  });
});
