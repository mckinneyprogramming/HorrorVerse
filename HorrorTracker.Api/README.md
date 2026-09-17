# HorrorTracker.Api

ASP.NET Core API in front of the existing PostgreSQL catalog. The TypeScript PWA calls this service; it never talks to the database itself.

## Run

Set the same connection string the console and WinForms apps use:

```bash
$env:HorrorVerseDb = "Host=localhost;Username=postgres;Password=...;Database=HorrorTracker"
dotnet run --launch-profile http
```

Listens on `http://localhost:5116`.

- `GET /api/health`
- `GET /api/catalog`
- `GET /api/catalog/{kind}` — `movie`, `series`, `show`, `documentary`, or `book`

You can also put the string in `ConnectionStrings:HorrorVerse` in `appsettings.json` or user secrets. `HorrorVerseDb` wins if both are set.
