# HorrorVerse web app

A TypeScript progressive web app (PWA) you can open in a browser and save to the home screen on iPhone and Android. It is a webpage that launches like an app: full screen, with its own icon, no App Store or Play Store fee.

Local titles are stored in the browser for now. The console and Windows apps remain the source of truth for the PostgreSQL catalog.

## Run it

```bash
cd HorrorTracker.WebApp
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

To test install on a phone on the same Wi-Fi, use HTTPS so Safari and Chrome treat it as a real PWA:

```bash
npm run dev:https
```

Accept the local certificate warning, then follow the install steps on the **Install** tab.

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

Installed, it opens without the browser chrome. Production hosting must be HTTPS.
