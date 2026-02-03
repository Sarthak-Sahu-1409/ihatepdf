import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache PDF libraries
registerRoute(
  ({ url }) => url.pathname.includes('pdf'),
  new CacheFirst({
    cacheName: 'pdf-libraries',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache static assets
registerRoute(
  ({ request }) => request.destination === 'script' ||
                   request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});