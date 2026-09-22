import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildApp } from './app'
import { loadEnv, resolveDbPath } from './db'
import { loadFixtures } from './fixtures'
import { generateSeed } from './seed'
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

  // On hosts without a persistent disk (e.g. Render's free tier), the database resets on every
  // restart/spin-down. AUTO_SEED re-populates it on boot so the deployed app is never empty.
  if (process.env.AUTO_SEED === 'true' && (await store.distributors.list()).length === 0) {
    await loadFixtures(store, generateSeed(new Date()))
    console.log('AUTO_SEED: database was empty, loaded the demo network.')
  }

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
