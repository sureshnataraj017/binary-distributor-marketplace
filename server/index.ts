import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildApp } from './app'
import { loadEnv, resolveDbPath } from './db'
import { createStore } from './store'

loadEnv()

const port = Number(process.env.PORT ?? 3001)
const latencyMs = Number(process.env.SIMULATE_LATENCY_MS ?? 0)
const path = resolveDbPath()
const distDir = resolve(import.meta.dirname, '..', 'dist')
const staticDir = existsSync(distDir) ? distDir : undefined

async function main() {
  const store = await createStore({ path }).catch((error: Error) => {
    console.error(
      `\nCannot open the SQLite database at "${path}".\n` +
        `Check that the process can create/write that file and its folder.\n(${error.message})\n`,
    )
    process.exit(1)
  })
  const app = buildApp({ store, logger: true, latencyMs, staticDir })

  // Stop accepting requests, then close the database connection, on Ctrl+C / container stop.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void app
        .close()
        .then(() => store.close())
        .finally(() => process.exit(0))
    })
  }

  app.log.info(`Database: ${path}`)
  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
