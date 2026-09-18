# HorrorTracker.Api

ASP.NET Core host for the PostgreSQL catalog **and** the production PWA. The TypeScript app never talks to the database itself. In production it is just static files served from this process, so `/api/catalog` is same-origin.

## Local development

Set the same connection string the console and WinForms apps use, then run API + Vite:

```bash
$env:HorrorVerseDb = "Host=localhost;Username=postgres;Password=...;Database=HorrorTracker"
cd HorrorTracker.Api
dotnet run --launch-profile http
```

Vite (`npm run dev`) proxies `/api` to `http://localhost:5116`.

- `GET /api/health`
- `GET /api/catalog`
- `GET /api/catalog/{kind}` — `movie`, `series`, `show`, `documentary`, or `book`
- `POST /api/catalog` — administrator create `{ "title", "kind", "completed", "releaseYear?" }`
- `PATCH /api/catalog` — administrator update `{ "id", "title", "completed" }`
- `DELETE /api/catalog?id=movie:1` — administrator delete
- `GET /api/auth` — current user, or `{ "user": null }`
- `POST /api/auth` — `{ "action": "register" | "login", "email", "password", "displayName?" }`
- `DELETE /api/auth` — sign out
- `GET /api/progress` — signed-in user's finished title ids
- `PATCH /api/progress` — `{ "id": "movie:1", "completed": true }`
- `GET /api/lists` — signed-in user's named lists
- `POST /api/lists` — `{ "name" }` creates a list, or `{ "listId", "itemId" }` adds a title
- `PATCH /api/lists` — `{ "id", "name" }` renames a list
- `DELETE /api/lists?id=1` — deletes a list
- `DELETE /api/lists?listId=1&itemId=movie:1` — removes a title from a list

Set `ADMIN_EMAIL` to the one address that should be an administrator. Everyone else who registers is a member. Passwords stay on the server; the webpage only sends them over HTTPS to `/api/auth`.

## Production (one origin, phones can install)

Build the webpage into this API, then expose that process over **HTTPS**. The home-screen app will call `/api` on the same host and read Postgres.

```bash
cd HorrorTracker.WebApp
npm ci
npm run build

cd ../HorrorTracker.Api
dotnet build
dotnet run --launch-profile production
```

That listens on `http://localhost:5088` and serves the PWA from `wwwroot`. Port 8080 is left alone (EnterpriseDB often uses it).

`dotnet publish -c Release` also runs `npm ci` / `npm run build` and copies the files into the published `wwwroot`.

### Option A — keep your current Postgres, get a public HTTPS URL

Your database stays on this PC. Run the API locally, then put a tunnel in front of it (Cloudflare Tunnel, ngrok, etc.):

```bash
cloudflared tunnel --url http://localhost:5088
```

Open the `https://…` URL on the phone, then **Add to Home Screen**. The app talks to that HTTPS origin, which forwards to this API, which reads local Postgres.

Postgres must allow connections from the API process (`localhost` is fine for this option).

### Option B — Docker

```bash
# From Docker Desktop, host.docker.internal reaches Postgres on the Windows machine
$env:HorrorVerseDb = "Host=host.docker.internal;Username=postgres;Password=...;Database=HorrorTracker"
docker compose up --build
```

Then tunnel `http://localhost:5088` the same way, or put the image on a host that can reach a cloud Postgres (set `HorrorVerseDb` to that host, not `localhost`).

A cloud server **cannot** use `Host=localhost` for the database on your PC. Move Postgres (Neon, Azure, etc.) or use Option A.

`HorrorVerseDb` always wins over `ConnectionStrings:HorrorVerse`. Never put the password in the TypeScript app or in git.
