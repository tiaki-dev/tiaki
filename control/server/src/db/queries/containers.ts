import { and, eq, sql } from 'drizzle-orm'
import { db } from '../index.js'
import { agents, containers, type Container, type NewContainer } from '../schema.js'

export interface ContainerWithAgent extends Container {
  agentName: string
}

export interface ContainerFilters {
  agentId?: string | undefined
  image?: string | undefined
}

export async function findAllContainers(filters: ContainerFilters = {}): Promise<Container[]> {
  const conditions = []
  if (filters.agentId) conditions.push(eq(containers.agentId, filters.agentId))
  if (filters.image) conditions.push(sql`${containers.image} ILIKE ${'%' + filters.image + '%'}`)

  return conditions.length > 0
    ? db.select().from(containers).where(and(...conditions)).orderBy(containers.name)
    : db.select().from(containers).orderBy(containers.name)
}

export async function findAllContainersWithAgent(
  filters: ContainerFilters = {},
): Promise<ContainerWithAgent[]> {
  const conditions = []
  if (filters.agentId) conditions.push(eq(containers.agentId, filters.agentId))
  if (filters.image) conditions.push(sql`${containers.image} ILIKE ${'%' + filters.image + '%'}`)

  const rows = await db
    .select({ container: containers, agentName: agents.name })
    .from(containers)
    .leftJoin(agents, eq(containers.agentId, agents.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(containers.name)

  return rows.map((r) => ({ ...r.container, agentName: r.agentName ?? '' }))
}

export async function findContainerById(id: string): Promise<Container | undefined> {
  const rows = await db.select().from(containers).where(eq(containers.id, id)).limit(1)
  return rows[0]
}

export async function findContainerByAgentAndDockerIdOrCreate(
  agentId: string,
  containerId: string,
): Promise<Container | undefined> {
  const rows = await db
    .select()
    .from(containers)
    .where(and(eq(containers.agentId, agentId), eq(containers.containerId, containerId)))
    .limit(1)
  return rows[0]
}

/**
 * Upsert a batch of containers for an agent.
 * Uses INSERT ... ON CONFLICT DO UPDATE to handle re-reports.
 */
export async function upsertContainers(rows: NewContainer[]): Promise<Container[]> {
  if (rows.length === 0) return []
  return db
    .insert(containers)
    .values(rows)
    .onConflictDoUpdate({
      target: [containers.agentId, containers.containerId],
      set: {
        name: sql`excluded.name`,
        image: sql`excluded.image`,
        currentTag: sql`excluded.current_tag`,
        currentDigest: sql`excluded.current_digest`,
        composeFile: sql`excluded.compose_file`,
        composeService: sql`excluded.compose_service`,
        namespace: sql`excluded.namespace`,
        lastScannedAt: sql`excluded.last_scanned_at`,
      },
    })
    .returning()
}

/**
 * Remove containers for an agent that were NOT in the last report,
 * but skip containers that have terminal update_results (deployed/failed/etc)
 * so audit history is preserved.
 */
export async function deleteStaleContainers(
  agentId: string,
  activeContainerIds: string[],
): Promise<void> {
  if (activeContainerIds.length === 0) {
    await db.execute(sql`
      DELETE FROM containers
      WHERE agent_id = ${agentId}
        AND NOT EXISTS (
          SELECT 1 FROM update_results ur
          WHERE ur.container_id = containers.id
            AND ur.status::text IN ('deployed', 'failed', 'rolled_back', 'ignored')
        )
    `)
    return
  }

  // Build a NOT IN list — Drizzle serializes JS arrays as records, not pg arrays,
  // so we use sql.join to produce individual bound parameters instead.
  const idList = sql.join(activeContainerIds.map((id) => sql`${id}`), sql`, `)
  await db.execute(sql`
    DELETE FROM containers
    WHERE agent_id = ${agentId}
      AND container_id NOT IN (${idList})
      AND NOT EXISTS (
        SELECT 1 FROM update_results ur
        WHERE ur.container_id = containers.id
          AND ur.status::text IN ('deployed', 'failed', 'rolled_back', 'ignored')
      )
  `)
}
