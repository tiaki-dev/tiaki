import { eq, sql } from 'drizzle-orm'
import { db } from '../index.js'
import { agents, type Agent, type NewAgent } from '../schema.js'

export async function findAllAgents(): Promise<Agent[]> {
  return db.select().from(agents).orderBy(agents.createdAt)
}

export async function findAgentById(id: string): Promise<Agent | undefined> {
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  return rows[0]
}

export async function findAgentByKeyPrefix(prefix: string): Promise<Agent | undefined> {
  const rows = await db.select().from(agents).where(eq(agents.keyPrefix, prefix)).limit(1)
  return rows[0]
}

export async function createAgent(data: NewAgent): Promise<Agent> {
  const rows = await db.insert(agents).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('Failed to create agent')
  return row
}

export async function updateAgentLastSeen(id: string): Promise<void> {
  await db
    .update(agents)
    .set({ lastSeenAt: new Date(), status: 'online' })
    .where(eq(agents.id, id))
}

export async function updateAgentStatus(
  id: string,
  status: Agent['status'],
): Promise<void> {
  await db.update(agents).set({ status }).where(eq(agents.id, id))
}

export async function renameAgent(id: string, name: string): Promise<Agent> {
  const rows = await db.update(agents).set({ name }).where(eq(agents.id, id)).returning()
  const row = rows[0]
  if (!row) throw new Error(`Agent ${id} not found`)
  return row
}

export async function deleteAgent(id: string): Promise<void> {
  await db.delete(agents).where(eq(agents.id, id))
}

/** Mark agents as offline if they haven't sent a heartbeat within `thresholdMs` */
export async function markStaleAgentsOffline(thresholdMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - thresholdMs)
  await db
    .update(agents)
    .set({ status: 'offline' })
    .where(
      sql`${agents.status} = 'online' AND ${agents.lastSeenAt} < ${cutoff}`,
    )
}
