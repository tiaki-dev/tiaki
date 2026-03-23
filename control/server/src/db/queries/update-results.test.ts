/**
 * Integration tests for update-results DB queries.
 * Requires DATABASE_URL pointing to a running PostgreSQL instance.
 * Run: DATABASE_URL=postgres://... npx vitest run src/db/queries/update-results.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { bulkSetDeploying, upsertUpdateResult } from './update-results.js'
import { agents, containers, updateResults } from '../schema.js'
import { eq } from 'drizzle-orm'

const DATABASE_URL = process.env['DATABASE_URL']
const describeOrSkip = DATABASE_URL ? describe : describe.skip

const TEST_AGENT_ID = `test-ur-agent-${Date.now()}`

describeOrSkip('bulkSetDeploying', () => {
  let pool: Pool
  let containerDbId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })
    const db = drizzle(pool)
    const now = new Date()

    await db.insert(agents).values({
      id: TEST_AGENT_ID,
      name: 'test-ur-agent',
      type: 'vm',
      apiKeyHash: 'test-hash',
      status: 'online',
      createdAt: now,
    })

    const [c] = await db.insert(containers).values({
      id: `tc-${Date.now()}`,
      agentId: TEST_AGENT_ID,
      containerId: `docker-ur-${Date.now()}`,
      name: 'test-container',
      image: 'nginx',
      currentTag: '1.0',
      currentDigest: null,
      composeFile: null,
      composeService: null,
      namespace: null,
      lastScannedAt: now,
      createdAt: now,
    }).returning()
    containerDbId = c!.id
  })

  afterAll(async () => {
    const db = drizzle(pool)
    await db.delete(updateResults).where(eq(updateResults.agentId, TEST_AGENT_ID))
    await db.delete(containers).where(eq(containers.agentId, TEST_AGENT_ID))
    await db.delete(agents).where(eq(agents.id, TEST_AGENT_ID))
    await pool.end()
  })

  it('sets status to deploying for given IDs without SQL error', async () => {
    // Regression: bulkSetDeploying used ANY(${ids}::uuid[]) which caused
    // "operator does not exist: text = uuid" because Drizzle serializes
    // JS string[] as a PG record type, not a uuid array.
    const now = new Date()
    const result = await upsertUpdateResult({
      id: `ur-${Date.now()}`,
      containerId: containerDbId,
      agentId: TEST_AGENT_ID,
      currentTag: '1.0',
      latestTag: '1.1',
      latestDigest: null,
      changelogUrl: null,
      vulnerabilities: null,
      status: 'approved',
      foundAt: now,
    })

    await expect(bulkSetDeploying([result.id])).resolves.toBeUndefined()

    const db = drizzle(pool)
    const [updated] = await db
      .select()
      .from(updateResults)
      .where(eq(updateResults.id, result.id))

    expect(updated?.status).toBe('deploying')
  })

  it('is a no-op for empty array', async () => {
    await expect(bulkSetDeploying([])).resolves.toBeUndefined()
  })
})
