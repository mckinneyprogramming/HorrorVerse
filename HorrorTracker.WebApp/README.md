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
