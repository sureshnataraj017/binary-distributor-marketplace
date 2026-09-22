import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixtures } from './fixtures'
import { generateSeed } from './seed'
import { createStore, type Store } from './store'

const TEST_DIR = resolve(import.meta.dirname, 'data', 'test')

/** Removes test database files left behind by runs that were killed before they could clean up. */
export function dropStaleTestDatabases(): void {
  if (!existsSync(TEST_DIR)) return
  for (const file of readdirSync(TEST_DIR)) rmSync(resolve(TEST_DIR, file), { force: true })
}

export interface TestStore {
  store: Store
  /** Path to the isolated database file, so a test can reopen it to simulate a restart. */
  path: string
  /** Deletes the isolated database file and closes the connection. Call from afterAll. */
  dispose(): Promise<void>
}

/**
 * A real SQLite database inside its own throwaway file, so test files run side by side without
 * seeing each other's data. Tests use the same database engine as production, not an emulation.
 * With `fixtures: true` it is pre-loaded with the generated demo network.
 */
export async function createTestStore({ fixtures = false } = {}): Promise<TestStore> {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  const path = resolve(TEST_DIR, `${randomUUID()}.db`)

  const store = await createStore({ path })
  if (fixtures) await loadFixtures(store, generateSeed(new Date()))

  return {
    store,
    path,
    async dispose() {
      await store.close()
      for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true })
    },
  }
}
