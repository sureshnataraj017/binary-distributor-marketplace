import { buildApp } from './app'
import { ensureDatabase, loadEnv } from './db'
import { createStore } from './store'

loadEnv()

const port = Number(process.env.PORT ?? 3001)
const latencyMs = Number(process.env.SIMULATE_LATENCY_MS ?? 0)
const database = process.env.PGDATABASE ?? 'marketplace'

async function main() {
  try {
    await ensureDatabase(database)
  } catch (error) {
    const { PGHOST = 'localhost', PGPORT = '5432', PGUSER = 'postgres' } = process.env
    console.error(
      `\nCannot reach PostgreSQL at ${PGHOST}:${PGPORT} as "${PGUSER}".\n` +
        `Is the PostgreSQL service running, and are PGHOST / PGPORT / PGUSER / PGPASSWORD correct in .env?\n` +
        `(${(error as Error).message})\n`,
    )
    process.exit(1)
  }

  const store = await createStore({ database })
  const app = buildApp({ store, logger: true, latencyMs })

  // Stop accepting requests, then release the database connections, on Ctrl+C / container stop.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void app
        .close()
        .then(() => store.close())
        .finally(() => process.exit(0))
    })
  }

  app.log.info(`Database: ${database}`)
  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
