# 🩸 HorrorVerse

> “Every scream, every shadow, every story — all connected in the HorrorVerse.”

HorrorVerse is a personal horror tracking ecosystem designed to catalog and celebrate every chilling piece of horror media — from terrifying films and eerie TV shows to unsettling documentaries, spine-tingling podcasts, haunting books, and horror-inspired games.  

It’s more than a tracker — it’s an evolving **horror universe** where your viewing, reading, and listening habits unlock **badges, achievements, and hidden lore** as you explore the darker corners of the genre.

---

## 👻 Features

- 🎬 **Track Horror Content**
  - Movies, TV Shows, Episodes, Documentaries, Books, Podcasts, and Games.
- 🔍 **TMDB Integration**
  - Seamless lookup of horror movies, documentaries, and shows via [TMDB API](https://www.themoviedb.org/documentation/api).
- 🏆 **Achievements & Badges**
  - Earn rewards for watching, finishing, and exploring horror across different categories.
  - Examples:  
    - *“First Blood”* – Watch your first horror movie.  
    - *“The Collector”* – Complete a full horror series.  
    - *“Dark Scholar”* – Read your first horror novel.
- 💀 **Categorized Horror Experience**
  - Distinguishes between films, series, episodes, docs, books, and more.
- 🧩 **Scalable Design**
  - Built with modularity in mind — managers, providers, and facades separate layers for easier expansion.
- 📱 **Installable web app**
  - TypeScript PWA you can open in a browser and save to the home screen on iPhone and Android.

---

## 🧠 Architecture & Tech Stack

| Layer | Purpose |
|-------|----------|
| **Windows Forms UI** | Desktop tracker against the PostgreSQL catalog. |
| **Web App (PWA)** | TypeScript app in `HorrorTracker.WebApp` that installs to a phone home screen. |
| **Web API** | `HorrorTracker.Api` reads the PostgreSQL catalog for the PWA. |
| **PostgreSQL Database** | Stores user data, horror entries, achievements, and relationships. |
| **TMDB API (via TMDbLib)** | Fetches real-time horror content metadata. |
| **C# & .NET** | Core logic and application framework. |
| **Serilog + Seq** | Logging and monitoring for development and debugging. |

### 🗃 Database Entities

- **Movies** – Title, Series, Runtime, Release Year, Watched
- **Series** – Title, TotalMovies, TotalTime, Watched
- **Documentaries** – Title, TotalTime, Release Year, Watched
- **TelevisionShows** – Title, TotalEpisodes, Years, Watched
- **Episodes** – Title, Runtime, Show, Release Date
- **Books** – Title, Author, Pages, Read
- **Podcasts** – Title, Host, Episodes, Listened
- **Badges & Achievements** – Linked to user activity

---

## 📱 Web app

The MAUI project is gone. Phone and tablet use is the TypeScript PWA in `HorrorTracker.WebApp`. It reads the catalog through `HorrorTracker.Api`.

```bash
# terminal 1
cd HorrorTracker.Api
dotnet run --launch-profile http

# terminal 2
cd HorrorTracker.WebApp
npm install
npm run dev
```

Set `HorrorVerseDb` to your PostgreSQL connection string (same variable the WinForms app uses). Vite proxies `/api` to `http://localhost:5116`.

For a phone home-screen app that reads the live database, host **one HTTPS origin** that serves both the webpage and `/api` (the API project does that in production). See [`HorrorTracker.Api/README.md`](HorrorTracker.Api/README.md). `localhost` on the phone is the phone, not this PC.

