import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

const { Pool, Client, types } = pg

// PostgreSQL returns some types in ways that do not match how the app models them. Fix that once, here.
types.setTypeParser(20, (value) => Number(value)) //   BIGINT (money in cents) -> number
types.setTypeParser(1700, (value) => Number(value)) // NUMERIC (percentages)    -> number
types.setTypeParser(1184, (value) => new Date(value).toISOString()) // TIMESTAMPTZ -> ISO string

const MIGRATIONS_DIR = resolve(import.meta.dirname, 'migrations')
const MIGRATION_LOCK_ID = 727_274

/** Loads `.env` from the project root into process.env. Variables that are already set win. */
export function loadEnv() {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, '..', '.env'))
  } catch {
    /* no .env file: rely on the real environment */
  }
}

export interface ConnectionOptions {
  /** Defaults to PGDATABASE. */
  database?: string
  /** Isolate everything inside one schema (used by tests). Defaults to `public`. */
  schema?: string
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

export function createPool({ database, schema }: ConnectionOptions = {}): pg.Pool {
  if (schema && !IDENTIFIER.test(schema)) throw new Error(`Invalid schema name: ${schema}`)
  return new Pool({
    // Host, port, user and password come from the PG* environment variables.
    ...(database ? { database } : {}),
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
    max: 10,
  })
}

/** Creates the database if it does not exist yet, so a fresh install needs no manual setup. */
export async function ensureDatabase(name: string): Promise<void> {
  if (!IDENTIFIER.test(name)) throw new Error(`Invalid database name: ${name}`)
  const admin = new Client({ database: 'postgres' })
  await admin.connect()
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`)
  } finally {
    await admin.end()
  }
}

/**
 * Applies every not-yet-applied `migrations/*.sql` file, in filename order, each in its own transaction.
 * An advisory lock makes it safe if two server instances start at the same moment.
 */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name        TEXT PRIMARY KEY,
         applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations')
    const done = new Set(rows.map((row) => row.name))

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    for (const file of files) {
      if (done.has(file)) continue
      try {
        await client.query('BEGIN')
        await client.query(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'))
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied.push(file)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined)
    client.release()
  }
  return applied
}
