import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../index.js'
import { agents, updateResults, containers, type UpdateResult, type NewUpdateResult } from '../schema.js'

export interface UpdateResultFilters {
  status?: UpdateResult['status'] | undefined
  agentId?: string | undefined
}

export interface UpdateResultWithAgent extends UpdateResult {
  agentName: string
  containerName: string
}

export async function findAllUpdateResultsWithAgent(
  filters: UpdateResultFilters = {},
): Promise<UpdateResultWithAgent[]> {
  const conditions = []
  if (filters.status) conditions.push(eq(updateResults.status, filters.status))
  if (filters.agentId) conditions.push(eq(updateResults.agentId, filters.agentId))

  const rows = await db
    .select({
      ur: updateResults,
      agentName: agents.name,
      containerName: containers.name,
    })
    .from(updateResults)
    .leftJoin(agents, eq(updateResults.agentId, agents.id))
    .leftJoin(containers, eq(updateResults.containerId, containers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(updateResults.foundAt)

  return rows.map((r) => ({
    ...r.ur,
    agentName: r.agentName ?? '',
    containerName: r.containerName ?? '',
  }))
}

export async function findAllUpdateResults(
  filters: UpdateResultFilters = {},
): Promise<UpdateResult[]> {
  const conditions = []
  if (filters.status) conditions.push(eq(updateResults.status, filters.status))
  if (filters.agentId) conditions.push(eq(updateResults.agentId, filters.agentId))

  return conditions.length > 0
    ? db.select().from(updateResults).where(and(...conditions)).orderBy(updateResults.foundAt)
    : db.select().from(updateResults).orderBy(updateResults.foundAt)
}

export async function findUpdateResultById(id: string): Promise<UpdateResult | undefined> {
  const rows = await db.select().from(updateResults).where(eq(updateResults.id, id)).limit(1)
  return rows[0]
}

export interface DeployCommand {
  updateResultId: string
  dockerContainerId: string
  image: string
  latestTag: string
  composeFile: string | null
  composeService: string | null
}

export async function findApprovedCommandsByAgent(agentId: string): Promise<DeployCommand[]> {
  // Join to the latest-scanned container with the same (agentId, name) so that
  // if a container was recreated (new Docker ID) the command still targets the current container.
  const rows = await db.execute<{
    update_result_id: string
    docker_container_id: string
    image: string
    latest_tag: string
    compose_file: string | null
    compose_service: string | null
  }>(sql`
    SELECT
      ur.id                 AS update_result_id,
      cur_c.container_id    AS docker_container_id,
      stored_c.image        AS image,
      ur.latest_tag         AS latest_tag,
      cur_c.compose_file    AS compose_file,
      cur_c.compose_service AS compose_service
    FROM update_results ur
    INNER JOIN containers stored_c ON ur.container_id = stored_c.id
    INNER JOIN containers cur_c ON (
      cur_c.agent_id = stored_c.agent_id
      AND cur_c.name = stored_c.name
      AND cur_c.last_scanned_at = (
        SELECT MAX(c2.last_scanned_at)
        FROM containers c2
        WHERE c2.agent_id = stored_c.agent_id AND c2.name = stored_c.name
      )
    )
    WHERE ur.agent_id = ${agentId}
      AND ur.status::text IN ('approved', 'deploying')
  `)
  return rows.rows.map((r) => ({
    updateResultId: r.update_result_id,
    dockerContainerId: r.docker_container_id,
    image: r.image,
    latestTag: r.latest_tag,
    composeFile: r.compose_file,
    composeService: r.compose_service,
  }))
}

export interface RollbackCommand {
  updateResultId: string
  dockerContainerId: string
  image: string
  previousTag: string
  composeFile: string | null
  composeService: string | null
}

export async function findRollbackCommandsByAgent(agentId: string): Promise<RollbackCommand[]> {
  // Join to the latest-scanned container with the same (agentId, name) so that
  // if the container was recreated after deploy (new Docker ID) the rollback still
  // targets the currently-running container, not the stale stored ID.
  const rows = await db.execute<{
    update_result_id: string
    docker_container_id: string
    image: string
    previous_tag: string | null
    compose_file: string | null
    compose_service: string | null
  }>(sql`
    SELECT
      ur.id                 AS update_result_id,
      cur_c.container_id    AS docker_container_id,
      stored_c.image        AS image,
      ur.previous_tag       AS previous_tag,
      cur_c.compose_file    AS compose_file,
      cur_c.compose_service AS compose_service
    FROM update_results ur
    INNER JOIN containers stored_c ON ur.container_id = stored_c.id
    INNER JOIN containers cur_c ON (
      cur_c.agent_id = stored_c.agent_id
      AND cur_c.name = stored_c.name
      AND cur_c.last_scanned_at = (
        SELECT MAX(c2.last_scanned_at)
        FROM containers c2
        WHERE c2.agent_id = stored_c.agent_id AND c2.name = stored_c.name
      )
    )
    WHERE ur.agent_id = ${agentId}
      AND ur.status::text = 'rollback_requested'
  `)
  return rows.rows
    .filter((r) => r.previous_tag !== null)
    .map((r) => ({
      updateResultId: r.update_result_id,
      dockerContainerId: r.docker_container_id,
      image: r.image,
      previousTag: r.previous_tag as string,
      composeFile: r.compose_file,
      composeService: r.compose_service,
    }))
}

export async function createUpdateResult(data: NewUpdateResult): Promise<UpdateResult> {
  const rows = await db.insert(updateResults).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('Failed to create update result')
  return row
}

export async function upsertUpdateResult(data: NewUpdateResult): Promise<UpdateResult> {
  // If same container + latestTag already exists, keep existing status (don't overwrite approved/deployed)
  const rows = await db
    .insert(updateResults)
    .values(data)
    .onConflictDoUpdate({
      target: [updateResults.containerId, updateResults.latestTag],
      set: {
        latestDigest: data.latestDigest ?? null,
        changelogUrl: data.changelogUrl ?? null,
        vulnerabilities: data.vulnerabilities ?? null,
        // Status stays as-is — do NOT reset approved/deployed back to pending
      },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('Failed to upsert update result')
  return row
}

export async function bulkSetDeploying(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  // Use sql.join with individual params — Drizzle serializes JS arrays as records,
  // not uuid[], causing "operator does not exist: text = uuid" with ANY(${ids}::uuid[])
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `)
  await db.execute(
    sql`UPDATE update_results SET status = 'deploying'::text::update_status WHERE id IN (${idList})`,
  )
}

export async function updateUpdateResultStatus(
  id: string,
  status: UpdateResult['status'],
  extra?: Partial<Pick<UpdateResult, 'deployedAt' | 'deployedBy' | 'deployLog' | 'previousTag' | 'previousDigest'>>,
): Promise<UpdateResult> {
  const rows = await db
    .update(updateResults)
    // Cast via text to work around node-postgres enum OID cache for newly added enum values
    .set({ status: sql`${status}::text::update_status`, ...extra })
    .where(eq(updateResults.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error(`Update result ${id} not found`)
  return row
}
