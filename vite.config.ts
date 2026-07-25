/**
 * Vícestránkový build: hra (index.html) + analytický dashboard
 * (analytika.html → /analytika přes rewrite ve vercel.json).
 */
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        analytika: fileURLToPath(new URL('./analytika.html', import.meta.url)),
      },
    },
  },
})
