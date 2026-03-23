import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../index.js'
import { agents, auditLog, updateResults, type AuditLogEntry, type NewAuditLogEntry } from '../schema.js'
import { newId } from '../../lib/id.js'

export interface AuditLogEntryWithAgent extends AuditLogEntry {
  agentName: string | null
}

export interface AuditLogPage {
  entries: AuditLogEntryWithAgent[]
  total: number
}

export async function createAuditEntry(
  data: Omit<NewAuditLogEntry, 'id' | 'createdAt'>,
): Promise<AuditLogEntry> {
  const rows = await db
    .insert(auditLog)
    .values({ id: newId(), ...data })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('Failed to create audit log entry')
  return row
}

export async function findAuditLogByUpdateResult(
  updateResultId: string,
): Promise<AuditLogEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.updateResultId, updateResultId))
    .orderBy(auditLog.createdAt)
}

export async function findAllAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  return db.select().from(auditLog).orderBy(auditLog.createdAt).limit(limit)
}

export async function findAuditLogPage(params: {
  page: number
  pageSize: number
}): Promise<AuditLogPage> {
  const offset = (params.page - 1) * params.pageSize

  const [rows, countRows] = await Promise.all([
    db
      .select({ entry: auditLog, agentName: agents.name })
      .from(auditLog)
      .leftJoin(updateResults, eq(auditLog.updateResultId, updateResults.id))
      .leftJoin(agents, eq(updateResults.agentId, agents.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(params.pageSize)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(auditLog),
  ])

  const entries = rows.map((r) => ({ ...r.entry, agentName: r.agentName ?? null }))
  const total = Number(countRows[0]?.count ?? 0)
  return { entries, total }
}

export async function findAllAuditLogWithAgent(limit = 200): Promise<AuditLogEntryWithAgent[]> {
  const rows = await db
    .select({ entry: auditLog, agentName: agents.name })
    .from(auditLog)
    .leftJoin(updateResults, eq(auditLog.updateResultId, updateResults.id))
    .leftJoin(agents, eq(updateResults.agentId, agents.id))
    .orderBy(auditLog.createdAt)
    .limit(limit)

  return rows.map((r) => ({ ...r.entry, agentName: r.agentName ?? null }))
}
