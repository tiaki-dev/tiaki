import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

interface Check {
  label: string
  query: string
}

const CHECKS: Check[] = [
  // Columns added by manual migrations (enum ADD VALUE + column adds)
  {
    label: 'policies.max_bump',
    query: `SELECT 1 FROM information_schema.columns WHERE table_name='policies' AND column_name='max_bump'`,
  },
  {
    label: 'update_results.vulnerabilities',
    query: `SELECT 1 FROM information_schema.columns WHERE table_name='update_results' AND column_name='vulnerabilities'`,
  },
  {
    label: 'update_results.release_summary',
    query: `SELECT 1 FROM information_schema.columns WHERE table_name='update_results' AND column_name='release_summary'`,
  },
  {
    label: "enum update_status value 'deploying'",
    query: `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='update_status' AND e.enumlabel='deploying'`,
  },
  {
    label: "enum notification_type value 'ntfy'",
    query: `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='notification_type' AND e.enumlabel='ntfy'`,
  },
]

/**
 * Verify that all expected schema elements exist.
 * Called at startup — exits the process if anything is missing so the error
 * is obvious immediately rather than surfacing as a cryptic 500 later.
 */
export async function verifySchema(): Promise<void> {
  const missing: string[] = []

  for (const check of CHECKS) {
    const rows = await db.execute(sql.raw(check.query))
    if (rows.rows.length === 0) {
      missing.push(check.label)
    }
  }

  if (missing.length > 0) {
    console.error('[server] schema verification FAILED — missing:')
    for (const m of missing) {
      console.error(`  ✗ ${m}`)
    }
    console.error('[server] run scripts/verify-migrations.sh to diagnose, then apply missing migrations manually.')
    process.exit(1)
  }

  console.log('[server] schema verified')
}
