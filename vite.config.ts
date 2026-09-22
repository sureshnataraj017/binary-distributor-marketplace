/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // Forward API calls to the Node server in dev, so the browser sees a single origin (no CORS).
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 3001}` },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Clears leftover SQLite test database files before the run.
    globalSetup: ['./server/globalSetup.ts'],
    css: false,
  },
})
