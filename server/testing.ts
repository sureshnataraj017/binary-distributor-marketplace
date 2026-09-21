import { randomUUID } from 'node:crypto'
import { loadEnv, ensureDatabase, createPool } from './db'
import { loadFixtures } from './fixtures'
import { generateSeed } from './seed'
import { createStore, type Store } from './store'

export const TEST_DATABASE = 'marketplace_test'

/** Removes schemas left behind by test runs that were killed before they could clean up. */
export async function dropStaleTestSchemas(): Promise<void> {
  loadEnv()
  await ensureDatabase(TEST_DATABASE)
  const pool = createPool({ database: TEST_DATABASE })
  try {
    const { rows } = await pool.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't\\_%'`,
    )
    for (const { schema_name } of rows) await pool.query(`DROP SCHEMA "${schema_name}" CASCADE`)
  } finally {
    await pool.end()
  }
}

export interface TestStore {
  store: Store
  /** Name of the isolated schema, so a test can reopen it to simulate a restart. */
  schema: string
  /** Drops the isolated schema and closes the connections. Call from afterAll. */
  dispose(): Promise<void>
}

/**
 * A real PostgreSQL store inside its own throwaway schema, so test files run in parallel without
 * seeing each other's data. Tests use the same database engine as production, not an emulation.
 * With `fixtures: true` it is pre-loaded with the generated demo network.
 */
export async function createTestStore({ fixtures = false } = {}): Promise<TestStore> {
  loadEnv()
  await ensureDatabase(TEST_DATABASE)
  const schema = `t_${randomUUID().replaceAll('-', '').slice(0, 12)}`

  const admin = createPool({ database: TEST_DATABASE })
  await admin.query(`CREATE SCHEMA ${schema}`)

  const store = await createStore({ database: TEST_DATABASE, schema })
  if (fixtures) await loadFixtures(store, generateSeed(new Date()))

  return {
    store,
    schema,
    async dispose() {
      await store.close()
      await admin.query(`DROP SCHEMA ${schema} CASCADE`)
      await admin.end()
    },
  }
}
