using HorrorTracker.Api.Catalog;
using Microsoft.AspNetCore.WebUtilities;
using Npgsql;
using System.Security.Cryptography;

namespace HorrorTracker.Api.Auth;

public sealed class AuthService(IConfiguration configuration)
{
    private const int SessionDays = 30;

    public AuthSession Register(AuthRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var password = request.Password ?? string.Empty;
        var displayName = NormalizeDisplayName(request.DisplayName, email);
        ValidateCredentials(email, password);

        EnsureSchema();

        try
        {
            using var connection = OpenConnection();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO app_user (email, display_name, password_hash, is_admin)
                VALUES (@email, @displayName, @passwordHash, @isAdmin)
                RETURNING id, email, display_name, is_admin
                """;
            command.Parameters.AddWithValue("email", email);
            command.Parameters.AddWithValue("displayName", displayName);
            command.Parameters.AddWithValue("passwordHash", PasswordHasher.Hash(password));
            command.Parameters.AddWithValue("isAdmin", IsAdminEmail(email));
            using var reader = command.ExecuteReader();
            if (!reader.Read())
            {
                throw new AuthException("Could not create the account.", StatusCodes.Status500InternalServerError);
            }

            return CreateSession(ReadUser(reader));
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            throw new AuthException("An account with that email already exists.", StatusCodes.Status409Conflict);
        }
    }

    public AuthSession Login(AuthRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var password = request.Password ?? string.Empty;
        ValidateCredentials(email, password);
        EnsureSchema();

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, email, display_name, is_admin, password_hash
            FROM app_user
            WHERE email = @email
            """;
        command.Parameters.AddWithValue("email", email);
        using var reader = command.ExecuteReader();
        if (!reader.Read() || !PasswordHasher.Verify(password, reader.GetString(4)))
        {
            throw new AuthException("Invalid email or password.", StatusCodes.Status401Unauthorized);
        }

        var user = SyncAdmin(ReadUser(reader));
        return CreateSession(user);
    }

    public AuthUserDto? GetCurrent(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT u.id, u.email, u.display_name, u.is_admin
            FROM app_session s
            JOIN app_user u ON u.id = s.user_id
            WHERE s.token = @token AND s.expires_at > NOW()
            """;
        command.Parameters.AddWithValue("token", token);
        using var reader = command.ExecuteReader();
        return reader.Read() ? SyncAdmin(ReadUser(reader)) : null;
    }

    public void Logout(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        EnsureSchema();
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM app_session WHERE token = @token";
        command.Parameters.AddWithValue("token", token);
        command.ExecuteNonQuery();
    }

    private AuthSession CreateSession(AuthUserDto user)
    {
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO app_session (token, user_id, expires_at)
            VALUES (@token, @userId, @expiresAt)
            """;
        command.Parameters.AddWithValue("token", token);
        command.Parameters.AddWithValue("userId", user.Id);
        command.Parameters.AddWithValue("expiresAt", DateTime.UtcNow.AddDays(SessionDays));
        command.ExecuteNonQuery();
        return new AuthSession(user, token);
    }

    private AuthUserDto SyncAdmin(AuthUserDto user)
    {
        var isAdmin = IsAdminEmail(user.Email);
        if (isAdmin == user.IsAdmin)
        {
            return user;
        }

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "UPDATE app_user SET is_admin = @isAdmin WHERE id = @id";
        command.Parameters.AddWithValue("isAdmin", isAdmin);
        command.Parameters.AddWithValue("id", user.Id);
        command.ExecuteNonQuery();
        return user with { IsAdmin = isAdmin };
    }

    private bool IsAdminEmail(string email)
    {
        var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL")
            ?? configuration["ADMIN_EMAIL"]
            ?? configuration["AdminEmail"];
        return !string.IsNullOrWhiteSpace(adminEmail)
            && string.Equals(email, adminEmail.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private void EnsureSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS app_user (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS app_session (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL
            );
            CREATE INDEX IF NOT EXISTS app_session_user_id_idx ON app_session (user_id);
            CREATE INDEX IF NOT EXISTS app_session_expires_at_idx ON app_session (expires_at);
            """;
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection OpenConnection()
    {
        var connectionString = CatalogService.ResolveConnectionString(configuration);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new AuthException("DATABASE_URL is not configured.", StatusCodes.Status503ServiceUnavailable);
        }

        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static AuthUserDto ReadUser(NpgsqlDataReader reader) =>
        new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetBoolean(3));

    private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string NormalizeDisplayName(string? displayName, string email)
    {
        var trimmed = (displayName ?? string.Empty).Trim();
        if (trimmed.Length > 0)
        {
            return trimmed.Length <= 80 ? trimmed : trimmed[..80];
        }

        var at = email.IndexOf('@');
        return at > 0 ? email[..at] : "Horror fan";
    }

    private static void ValidateCredentials(string email, string password)
    {
        if (email.Length is < 3 or > 254 || !email.Contains('@') || !email.Contains('.'))
        {
            throw new AuthException("Enter a valid email address.", StatusCodes.Status400BadRequest);
        }

        if (password.Length < 8)
        {
            throw new AuthException("Password must be at least 8 characters.", StatusCodes.Status400BadRequest);
        }

        if (password.Length > 256)
        {
            throw new AuthException("Password is too long.", StatusCodes.Status400BadRequest);
        }
    }
}

public sealed record AuthSession(AuthUserDto User, string Token);
