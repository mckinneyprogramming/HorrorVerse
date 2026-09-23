# HorrorVerse web app

A TypeScript progressive web app (PWA) you can open in a browser and save to the home screen on iPhone and Android.

The library is read from PostgreSQL through `HorrorTracker.Api`. The connection string stays on the server — never in this app.

## Run it

Set `HorrorVerseDb` to your Postgres connection string, then start both processes:

```bash
# terminal 1
cd HorrorTracker.Api
dotnet run --launch-profile http

# terminal 2
cd HorrorTracker.WebApp
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Vite proxies `/api` to `http://localhost:5116`.

To test install on a phone on the same Wi-Fi, use HTTPS so Safari and Chrome treat it as a real PWA:

```bash
npm run dev:https
```

The phone still needs a reachable API (not just `localhost` on your PC).

## Production

Do not install from Vite/`localhost` if you want the home-screen icon to keep working away from this PC. Publish the API so it serves this app from `wwwroot`, then put **HTTPS** in front of that process. Phones then open one URL; `/api/catalog` hits the same host and Postgres.

Details are in `HorrorTracker.Api/README.md`.

Live production uses these Vercel functions (`HorrorTracker.WebApp/api/*.ts`), not the C# API. Failures are logged with `console.error` in each function file. Read them with:

```bash
npx vercel logs --project horrorverse --scope mc-kinney-programming --environment production
```

Do not import other local modules into a Vercel function (`api/_lib`, `../lib`, or another `api/*.ts` file). Vercel compiles each route on its own and those imports have already caused `FUNCTION_INVOCATION_FAILED` in production.

## Add to Home Screen

**iPhone / iPad (Safari)**
1. Open the site in Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Tap Add.

**Android (Chrome)**
1. Open the site in Chrome.
2. Tap the menu and choose **Install app** or **Add to Home screen**.
3. Confirm.
