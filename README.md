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
- 🔮 **Future Expansion**
  - Plans for a web dashboard and Windows Forms UI to make tracking even more immersive.

---

## 🧠 Architecture & Tech Stack

| Layer | Purpose |
|-------|----------|
| **Console Application (Current)** | Core system for adding and managing horror content. |
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
