import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'inline',
      includeAssets: ['icon-192.png', 'icon-512.png', 'sql-wasm.wasm'],
      manifest: {
        name: 'ZK Location Proof',
        short_name: 'ZK Geo',
        description: 'Privacy-preserving location proofs using zero-knowledge cryptography',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        additionalManifestEntries: [
          { url: '/circuits/Main.wasm', revision: null },
          { url: '/circuits/Main_final.zkey', revision: null },
          { url: '/circuits/verification_key.json', revision: null },
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
    }),
  ],
  build: {
    target: 'esnext', // Must be esnext for BigInt support (required by snarkjs)
    minify: 'terser',
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
    esbuildOptions: {
      target: 'esnext', // Must be esnext for BigInt support
      supported: {
        bigint: true, // Explicitly enable BigInt
      },
    },
  },
})
