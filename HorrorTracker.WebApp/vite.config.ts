import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === "https" ? [basicSsl()] : []),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      devOptions: {
        enabled: true,
      },
      manifest: {
        id: "/",
        name: "HorrorVerse",
        short_name: "HorrorVerse",
        description: "Every scream, every shadow, every story — all connected.",
        theme_color: "#0A0A0A",
        background_color: "#0A0A0A",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["entertainment"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
}));
