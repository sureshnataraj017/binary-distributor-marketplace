import { clearData, loadFixtures } from './fixtures'
import { ensureDatabase, loadEnv } from './db'
import { generateSeed } from './seed'
import { createStore } from './store'

/**
 * Optional developer commands. The application itself always starts with an empty database.
 *   npm run db:seed   loads a generated demo network (only into an empty database)
 *   npm run db:clear  deletes all business data and restarts the id numbering
 */
loadEnv()
const command = process.argv[2]
const database = process.env.PGDATABASE ?? 'marketplace'

if (command !== 'seed' && command !== 'clear') {
  console.error('Usage: tsx server/dbTool.ts <seed|clear>')
  process.exit(1)
}

await ensureDatabase(database)
const store = await createStore({ database })
try {
  if (command === 'clear') {
    await clearData(store)
    console.log(`Cleared all data in "${database}".`)
  } else {
    if ((await store.distributors.list()).length > 0) {
      console.error(
        'The database already has data. Run `npm run db:clear` first if you want to replace it.',
      )
      process.exitCode = 1
    } else {
      const seed = generateSeed(new Date())
      await loadFixtures(store, seed)
      console.log(
        `Loaded ${seed.distributors.length} distributors, ${seed.retailers.length} retailers, ` +
          `${seed.sales.length} sales and ${seed.referrals.length} referrals into "${database}".`,
      )
    }
  }
} finally {
  await store.close()
}
