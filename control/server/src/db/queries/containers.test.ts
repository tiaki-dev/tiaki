/**
 * Integration tests for container DB queries.
 * Requires DATABASE_URL pointing to a running PostgreSQL instance.
 * Run: DATABASE_URL=postgres://... npx vitest run src/db/queries/containers.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { upsertContainers, deleteStaleContainers } from './containers.js'
import { agents, containers, updateResults } from '../schema.js'
import { eq } from 'drizzle-orm'

// Skip all tests if DATABASE_URL is not set
const DATABASE_URL = process.env['DATABASE_URL']
const describeOrSkip = DATABASE_URL ? describe : describe.skip

// Use a unique test agent ID so tests don't interfere with real data
const TEST_AGENT_ID = `test-agent-${Date.now()}`
const TEST_AGENT_KEY_HASH = 'test-hash'

describeOrSkip('deleteStaleContainers', () => {
  let pool: Pool

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })
    // Insert a minimal test agent row
    const db = drizzle(pool)
    await db.insert(agents).values({
      id: TEST_AGENT_ID,
      name: 'test-agent',
      type: 'vm',
      apiKeyHash: TEST_AGENT_KEY_HASH,
      status: 'online',
      createdAt: new Date(),
    })
  })

  afterAll(async () => {
    // Clean up all test data
    const db = drizzle(pool)
    await db.delete(containers).where(eq(containers.agentId, TEST_AGENT_ID))
    await db.delete(agents).where(eq(agents.id, TEST_AGENT_ID))
    await pool.end()
  })

  it('removes containers not in active list', async () => {
    const db = drizzle(pool)
    const now = new Date()

    // Create two containers
    const [c1, c2] = await upsertContainers([
      {
        id: `c1-${Date.now()}`,
        agentId: TEST_AGENT_ID,
        containerId: 'docker-id-aaa',
        name: 'container-a',
        image: 'nginx',
        currentTag: '1.0',
        currentDigest: null,
        composeFile: null,
        composeService: null,
        namespace: null,
        lastScannedAt: now,
        createdAt: now,
      },
      {
        id: `c2-${Date.now()}`,
        agentId: TEST_AGENT_ID,
        containerId: 'docker-id-bbb',
        name: 'container-b',
        image: 'postgres',
        currentTag: '16.0',
        currentDigest: null,
        composeFile: null,
        composeService: null,
        namespace: null,
        lastScannedAt: now,
        createdAt: now,
      },
    ])

    // Only container-a is still running
    await deleteStaleContainers(TEST_AGENT_ID, ['docker-id-aaa'])

    // container-b should be deleted
    const remaining = await db
      .select()
      .from(containers)
      .where(eq(containers.agentId, TEST_AGENT_ID))

    expect(remaining.map((c) => c.containerId)).toEqual(['docker-id-aaa'])
    expect(remaining.find((c) => c.containerId === 'docker-id-bbb')).toBeUndefined()

    // Cleanup
    await db.delete(containers).where(eq(containers.agentId, TEST_AGENT_ID))
    void c1
    void c2
  })

  it('keeps container with terminal update_results (history preservation)', async () => {
    const db = drizzle(pool)
    const now = new Date()

    // Create a container that has a deployed update_result
    const [c] = await upsertContainers([{
      id: `c3-${Date.now()}`,
      agentId: TEST_AGENT_ID,
      containerId: 'docker-id-ccc',
      name: 'deployed-container',
      image: 'postgres',
      currentTag: '16-alpine',
      currentDigest: null,
      composeFile: null,
      composeService: null,
      namespace: null,
      lastScannedAt: now,
      createdAt: now,
    }])

    // Insert a 'deployed' update result for this container
    await db.insert(updateResults).values({
      id: `ur-${Date.now()}`,
      containerId: c!.id,
      agentId: TEST_AGENT_ID,
      currentTag: '15-alpine',
      latestTag: '16-alpine',
      status: 'deployed',
      foundAt: now,
      deployedAt: now,
      deployedBy: 'admin',
    })

    // Container is no longer running (empty active list — use a different ID)
    await deleteStaleContainers(TEST_AGENT_ID, ['docker-id-other'])

    const remaining = await db
      .select()
      .from(containers)
      .where(eq(containers.agentId, TEST_AGENT_ID))

    expect(remaining.find((r) => r.containerId === 'docker-id-ccc')).toBeDefined()

    // Cleanup
    await db.delete(updateResults).where(eq(updateResults.containerId, c!.id))
    await db.delete(containers).where(eq(containers.agentId, TEST_AGENT_ID))
  })

  it('handles single active container ID without SQL error', async () => {
    // This is the regression test for the "cannot cast type record to text[]" bug.
    // The bug occurred because Drizzle serialized a JS string[] as a PG record,
    // not a text[] literal, when using ${array}::text[] in a sql template.
    const now = new Date()
    await upsertContainers([{
      id: `c4-${Date.now()}`,
      agentId: TEST_AGENT_ID,
      containerId: 'docker-id-ddd',
      name: 'container-d',
      image: 'alpine',
      currentTag: 'latest',
      currentDigest: null,
      composeFile: null,
      composeService: null,
      namespace: null,
      lastScannedAt: now,
      createdAt: now,
    }])

    // Should not throw
    await expect(
      deleteStaleContainers(TEST_AGENT_ID, ['docker-id-ddd']),
    ).resolves.toBeUndefined()

    // Cleanup
    const db = drizzle(pool)
    await db.delete(containers).where(eq(containers.agentId, TEST_AGENT_ID))
  })
})
