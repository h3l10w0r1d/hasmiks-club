import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (a hand-written src/sw.js precompiled with the
      // precache manifest injected) instead of the fully auto-generated
      // strategy — needed so the service worker can also handle `push` and
      // `notificationclick` events for Web Push notifications, which
      // generateSW has no hook for. Runtime caching rules that used to live
      // in `workbox` below now live directly in src/sw.js.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: "Hasmik's Club",
        short_name: "Hasmik's",
        description: "A curated women's community in Yerevan",
        theme_color: '#A85C5A',
        background_color: '#FAF6F2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
