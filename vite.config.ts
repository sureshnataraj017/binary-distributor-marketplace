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
    // Clears leftover test schemas in PostgreSQL before the run. Tests need the PostgreSQL server running.
    globalSetup: ['./server/globalSetup.ts'],
    css: false,
    // Real database round trips are slower than the in-memory tests they replace.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
