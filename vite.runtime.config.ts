import { localIconPlugin } from "./scripts/local-icon-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ command }) => ({
  base: "./",
  optimizeDeps: { entries: ["index.html"] },
  plugins: [
    localIconPlugin(command),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "捡手机",
        short_name: "捡手机",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        clientsClaim: true,
        // Disable Workbox's default offline HTML fallback so our NetworkFirst
        // navigation rule below actually takes effect.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigateFallback: null as any,
        // Do NOT precache index.html: every browser should fetch the newest
        // page and therefore the newest hashed JS/CSS on each launch.
        globPatterns: ["**/*.{js,css,svg,json,txt,png,jpg}"],
        maximumFileSizeToCacheInBytes: 4000000,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5 },
            },
          },
        ],
      },
    }),
  ],
}));
