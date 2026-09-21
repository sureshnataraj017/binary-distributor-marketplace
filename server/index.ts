import { resolve } from 'node:path'
import { buildApp } from './app'
import { createStore } from './store'

const port = Number(process.env.PORT ?? 3001)
const latencyMs = Number(process.env.SIMULATE_LATENCY_MS ?? 0)
// Override with DB_PATH; RESET_DB=1 rebuilds the demo data on start.
const dbPath = process.env.DB_PATH ?? resolve(import.meta.dirname, 'data', 'marketplace.db')

const store = createStore({ path: dbPath, reset: process.env.RESET_DB === '1' })
const app = buildApp({ store, logger: true, latencyMs })

// Close the HTTP server and flush the database on Ctrl+C / container stop.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().finally(() => {
      store.close()
      process.exit(0)
    })
  })
}

app.log.info(`Database: ${dbPath}`)
app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error)
  store.close()
  process.exit(1)
})
