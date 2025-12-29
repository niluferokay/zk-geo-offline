import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2015'
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['sql.js']
  }
})
