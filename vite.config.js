import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Include all asset types emitted by Vite — including .mjs (pdfjs worker)
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff,woff2}'],

        // Allow the precache manifest to be large (pdfjs is ~3 MB)
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,

        runtimeCaching: [
          {
            // Cache the jsdelivr CDN emoji images used on the Landing page.
            // After the first online visit they will work fully offline.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-emoji-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
              // status 0 = opaque response (cross-origin image without CORS)
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Skip waiting so updates activate immediately
        skipWaiting: true,
        clientsClaim: true,
      },

      manifest: {
        name: 'IHatePDF — Privacy PDF Tools',
        short_name: 'IHatePDF',
        description:
          'Merge, split, compress, convert, sign and watermark PDFs — 100% in your browser, no uploads, works offline.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#6366f1',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-lib': ['pdf-lib'],
          pdfjs: ['pdfjs-dist'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  worker: {
    format: 'es',
  },
});
