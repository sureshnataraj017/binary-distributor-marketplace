import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const MIGRATIONS_DIR = resolve(import.meta.dirname, 'migrations')

/** Loads `.env` from the project root into process.env. Variables that are already set win. */
export function loadEnv() {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, '..', '.env'))
  } catch {
    /* no .env file: rely on the real environment */
  }
}

/** Where the SQLite file lives. A relative path is resolved from the project root. */
export function resolveDbPath(path = process.env.DB_PATH ?? 'server/data/marketplace.db'): string {
  return path === ':memory:' ? path : resolve(import.meta.dirname, '..', path)
}

/**
 * Opens (creating if needed) the SQLite database file and configures the connection:
 * WAL journalling (readers do not block the writer), foreign keys enforced (off by default in
 * SQLite), and a busy timeout so a brief lock contention waits instead of failing immediately.
 */
export function openDatabase(path: string): Database.Database {
  if (path !== ':memory:') {
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  return db
}

/** Applies every not-yet-applied `migrations/*.sql` file, in filename order, each in its own transaction. */
export function migrate(db: Database.Database): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name        TEXT PRIMARY KEY,
       applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     )`,
  )
  const done = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(
      (row) => row.name,
    ),
  )

  const applied: string[] = []
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of files) {
    if (done.has(file)) continue
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8')
    const runMigration = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
    })
    try {
      runMigration()
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
    applied.push(file)
  }
  return applied
}
