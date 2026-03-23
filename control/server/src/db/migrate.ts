import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './index.js'

async function runMigrations(): Promise<void> {
  console.log('[migrate] running migrations...')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('[migrate] done')
  process.exit(0)
}

runMigrations().catch((err) => {
  console.error('[migrate] failed', err)
  process.exit(1)
})
