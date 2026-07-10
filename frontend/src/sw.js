import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
self.clients.claim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ url }) => /^https:\/\/hasmiks-club.*\.onrender\.com\/api\/.*/.test(url.href),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 300 })],
  }),
)

registerRoute(
  ({ url }) => /^https:\/\/res\.cloudinary\.com\/.*/.test(url.href),
  new CacheFirst({
    cacheName: 'cloudinary-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 86400 * 30 })],
  }),
)

// ── Web Push ─────────────────────────────────────────────────────────────────
// Payload shape sent by the backend (see app/core/push.py): { title, body, link }

self.addEventListener('push', (event) => {
  let data = { title: "Hasmik's Club", body: 'You have a new notification', link: '/dashboard' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch { /* non-JSON payload — fall back to defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { link: data.link },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/dashboard'
  const targetUrl = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus()
      }
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          client.focus()
          return client.navigate(targetUrl)
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})
