import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ─── Enums ──────────────────────────────────────────────────────────────────

export const agentTypeEnum = pgEnum('agent_type', ['vm', 'k8s'])
export const agentStatusEnum = pgEnum('agent_status', ['online', 'offline', 'unknown'])

export const updateStatusEnum = pgEnum('update_status', [
  'pending',
  'approved',
  'deploying',
  'deployed',
  'ignored',
  'failed',
  'rollback_requested',
  'rolled_back',
])

export const notificationTypeEnum = pgEnum('notification_type', ['email', 'webhook', 'ntfy'])
export const notificationStatusEnum = pgEnum('notification_status', ['sent', 'failed', 'pending'])

// ─── Tables ─────────────────────────────────────────────────────────────────

/**
 * Registered agents (VMs + K8s clusters).
 * Each agent has a unique API key (stored as argon2id hash).
 */
export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  type: agentTypeEnum('type').notNull(),
  apiKeyHash: text('api_key_hash').notNull(),
  /** First 16 hex chars of the raw key (after 'dw_' prefix) — for O(1) lookup, not a secret */
  keyPrefix: text('key_prefix'),
  status: agentStatusEnum('status').notNull().default('unknown'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
})

/**
 * Running containers reported by agents.
 * Upserted on every agent report — represents current state.
 */
export const containers = pgTable('containers', {
  id: text('id').primaryKey(), // UUID
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  containerId: text('container_id').notNull(), // Docker ID or K8s pod UID
  name: text('name').notNull(),
  image: text('image').notNull(), // without tag
  currentTag: text('current_tag').notNull(),
  currentDigest: text('current_digest'),
  composeFile: text('compose_file'),
  composeService: text('compose_service'),
  namespace: text('namespace'), // K8s only
  lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('containers_agent_container_idx').on(t.agentId, t.containerId),
])

/**
 * Detected updates — one row per (container, latestTag) pair.
 * Status tracks the approval and deployment lifecycle.
 */
export const updateResults = pgTable('update_results', {
  id: text('id').primaryKey(), // UUID
  containerId: text('container_id')
    .notNull()
    .references(() => containers.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  currentTag: text('current_tag').notNull(),
  latestTag: text('latest_tag').notNull(),
  latestDigest: text('latest_digest'),
  previousTag: text('previous_tag'), // for rollback
  previousDigest: text('previous_digest'),
  status: updateStatusEnum('status').notNull().default('pending'),
  changelogUrl: text('changelog_url'),
  releaseSummary: text('release_summary'),
  vulnerabilities: jsonb('vulnerabilities').$type<Array<{ id: string; severity: string; pkgName: string; title: string }>>(),
  foundAt: timestamp('found_at', { withTimezone: true }).notNull().defaultNow(),
  deployedAt: timestamp('deployed_at', { withTimezone: true }),
  deployedBy: text('deployed_by'), // 'system' | user ID
  deployLog: text('deploy_log'),
}, (t) => [
  uniqueIndex('update_results_container_tag_idx').on(t.containerId, t.latestTag),
])

/**
 * Notification log — records every sent notification.
 */
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(), // UUID
  type: notificationTypeEnum('type').notNull(),
  recipient: text('recipient').notNull(), // email address or webhook URL
  updateResultIds: jsonb('update_result_ids').$type<string[]>().notNull().default([]),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  status: notificationStatusEnum('status').notNull().default('pending'),
  error: text('error'),
})

/**
 * Update policies — Phase 2 feature, schema created in Phase 1.
 */
export const policies = pgTable('policies', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
  imagePattern: text('image_pattern').notNull(), // glob pattern e.g. "nginx:*"
  autoApprove: boolean('auto_approve').notNull().default(false),
  maxBump: text('max_bump'), // 'patch' | 'minor' | 'major' | null (null = any)
  notifyChannels: jsonb('notify_channels').$type<string[]>().notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Audit log — one entry per state-changing action.
 */
export const auditActionEnum = pgEnum('audit_action', [
  'approved',
  'ignored',
  'unignored',
  'deployed',
  'failed',
  'rollback_requested',
  'rollback_completed',
  'rollback_failed',
])

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(), // UUID
  updateResultId: text('update_result_id')
    .notNull()
    .references(() => updateResults.id, { onDelete: 'cascade' }),
  action: auditActionEnum('action').notNull(),
  actor: text('actor').notNull().default('system'), // 'system' | user ID
  detail: text('detail'), // optional free-text (deploy log line, error message, etc.)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type Container = typeof containers.$inferSelect
export type NewContainer = typeof containers.$inferInsert
export type UpdateResult = typeof updateResults.$inferSelect
export type NewUpdateResult = typeof updateResults.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Policy = typeof policies.$inferSelect
export type NewPolicy = typeof policies.$inferInsert
export type AuditLogEntry = typeof auditLog.$inferSelect
export type NewAuditLogEntry = typeof auditLog.$inferInsert
