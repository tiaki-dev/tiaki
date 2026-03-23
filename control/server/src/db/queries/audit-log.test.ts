/**
 * Integration tests for audit-log DB queries.
 * Requires DATABASE_URL pointing to a running PostgreSQL instance.
 * Run: DATABASE_URL=postgres://... npx vitest run src/db/queries/audit-log.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { createAuditEntry, findAuditLogPage } from './audit-log.js'
import { agents, auditLog, containers, updateResults } from '../schema.js'
import { newId } from '../../lib/id.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeOrSkip = DATABASE_URL ? describe : describe.skip

const TEST_AGENT_ID = `test-al-agent-${Date.now()}`
const INSERTED_ENTRIES = 75

describeOrSkip('findAuditLogPage', () => {
  let pool: Pool
  let updateResultId: string
  let expectedTotal: number

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })
    const db = drizzle(pool)

    // Record pre-existing rows so assertions remain valid on a non-empty DB
    const [baseline] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog)
    expectedTotal = (baseline?.count ?? 0) + INSERTED_ENTRIES

    const now = new Date()

    await db.insert(agents).values({
      id: TEST_AGENT_ID,
      name: 'test-al-agent',
      type: 'vm',
      apiKeyHash: 'test-hash',
      status: 'online',
      createdAt: now,
    })

    const containerId = newId()
    await db.insert(containers).values({
      id: containerId,
      agentId: TEST_AGENT_ID,
      containerId: `docker-al-${Date.now()}`,
      name: 'test-container',
      image: 'nginx',
      currentTag: '1.0',
      currentDigest: null,
      composeFile: null,
      composeService: null,
      namespace: null,
      lastScannedAt: now,
      createdAt: now,
    })

    updateResultId = newId()
    await db.insert(updateResults).values({
      id: updateResultId,
      containerId,
      agentId: TEST_AGENT_ID,
      currentTag: '1.0',
      latestTag: '1.1',
      status: 'pending',
      foundAt: now,
    })

    // Insert INSERTED_ENTRIES audit entries with distinct timestamps so ordering is deterministic
    for (let i = 0; i < INSERTED_ENTRIES; i++) {
      await createAuditEntry({
        updateResultId,
        action: 'approved',
        actor: `user-${i}`,
      })
    }
  })

  afterAll(async () => {
    const db = drizzle(pool)
    await db.delete(auditLog).where(eq(auditLog.updateResultId, updateResultId))
    await db.delete(updateResults).where(eq(updateResults.agentId, TEST_AGENT_ID))
    await db.delete(containers).where(eq(containers.agentId, TEST_AGENT_ID))
    await db.delete(agents).where(eq(agents.id, TEST_AGENT_ID))
    await pool.end()
  })

  it('page 1 returns first 50 entries and correct total', async () => {
    const result = await findAuditLogPage({ page: 1, pageSize: 50 })
    expect(result.entries.length).toBe(50)
    expect(result.total).toBe(expectedTotal)
  })

  it('page 2 returns remaining entries', async () => {
    const result = await findAuditLogPage({ page: 2, pageSize: 50 })
    expect(result.entries.length).toBe(expectedTotal - 50)
    expect(result.total).toBe(expectedTotal)
  })

  it('entries include agentName from join', async () => {
    const result = await findAuditLogPage({ page: 1, pageSize: 1 })
    expect(result.entries[0]?.agentName).toBe('test-al-agent')
  })

  it('out-of-range page returns empty entries with correct total', async () => {
    const result = await findAuditLogPage({ page: 99, pageSize: 50 })
    expect(result.entries.length).toBe(0)
    expect(result.total).toBe(expectedTotal)
  })

  it('custom pageSize returns correct slice', async () => {
    const result = await findAuditLogPage({ page: 3, pageSize: 10 })
    expect(result.entries.length).toBe(10)
    expect(result.total).toBe(expectedTotal)
  })
})
