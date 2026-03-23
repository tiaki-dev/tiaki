import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '../index.js'
import { agents, policies, type Policy, type NewPolicy } from '../schema.js'

export interface PolicyWithAgent extends Policy {
  agentName: string | null
}

export async function findAllPolicies(): Promise<Policy[]> {
  return db.select().from(policies).orderBy(policies.priority)
}

export async function findAllPoliciesWithAgent(): Promise<PolicyWithAgent[]> {
  const rows = await db
    .select({ policy: policies, agentName: agents.name })
    .from(policies)
    .leftJoin(agents, eq(policies.agentId, agents.id))
    .orderBy(policies.priority)

  return rows.map((r) => ({ ...r.policy, agentName: r.agentName ?? null }))
}

export async function findPolicyById(id: string): Promise<Policy | undefined> {
  const rows = await db.select().from(policies).where(eq(policies.id, id)).limit(1)
  return rows[0]
}

/**
 * Find enabled policies that could apply to a given agent.
 * Returns global policies (no agentId) + agent-specific policies.
 */
export async function findEnabledPoliciesForAgent(agentId: string): Promise<Policy[]> {
  return db
    .select()
    .from(policies)
    .where(
      and(
        eq(policies.enabled, true),
        or(isNull(policies.agentId), eq(policies.agentId, agentId)),
      ),
    )
    .orderBy(policies.priority)
}

export async function createPolicy(data: NewPolicy): Promise<Policy> {
  const rows = await db.insert(policies).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('Failed to create policy')
  return row
}

export type PolicyUpdate = {
  name?: string | undefined
  agentId?: string | null | undefined
  imagePattern?: string | undefined
  autoApprove?: boolean | undefined
  maxBump?: string | null | undefined
  notifyChannels?: string[] | undefined
  enabled?: boolean | undefined
  priority?: number | undefined
}

export async function updatePolicy(id: string, data: PolicyUpdate): Promise<Policy> {
  // Strip undefined values to satisfy exactOptionalPropertyTypes for Drizzle .set()
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>
  const rows = await db.update(policies).set(clean).where(eq(policies.id, id)).returning()
  const row = rows[0]
  if (!row) throw new Error(`Policy ${id} not found`)
  return row
}

export async function deletePolicy(id: string): Promise<void> {
  await db.delete(policies).where(eq(policies.id, id))
}
