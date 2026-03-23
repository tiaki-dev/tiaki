import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure, agentProcedure } from '../trpc.js'
import {
  findAllUpdateResultsWithAgent,
  findUpdateResultById,
  updateUpdateResultStatus,
} from '../db/queries/update-results.js'
import { createAuditEntry, findAuditLogByUpdateResult, findAllAuditLogWithAgent, findAuditLogPage } from '../db/queries/audit-log.js'

const updateStatusSchema = z.enum([
  'pending', 'approved', 'deploying', 'deployed',
  'ignored', 'failed', 'rollback_requested', 'rolled_back',
])

export const updatesRouter = router({
  list: adminProcedure
    .input(
      z.object({
        status: updateStatusSchema.optional(),
        agentId: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      return findAllUpdateResultsWithAgent(input ?? {})
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      return update
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending updates can be approved' })
      }
      const result = await updateUpdateResultStatus(input.id, 'approved')
      await createAuditEntry({ updateResultId: input.id, action: 'approved', actor: 'admin' })
      return result
    }),

  ignore: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending updates can be ignored' })
      }
      const result = await updateUpdateResultStatus(input.id, 'ignored')
      await createAuditEntry({ updateResultId: input.id, action: 'ignored', actor: 'admin' })
      return result
    }),

  unignore: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.status !== 'ignored') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only ignored updates can be restored to pending' })
      }
      const result = await updateUpdateResultStatus(input.id, 'pending')
      await createAuditEntry({ updateResultId: input.id, action: 'unignored', actor: 'admin' })
      return result
    }),

  triggerDeploy: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!['pending', 'approved'].includes(update.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Update cannot be deployed in current status' })
      }
      const result = await updateUpdateResultStatus(input.id, 'deploying', { deployedBy: 'system' })
      await createAuditEntry({ updateResultId: input.id, action: 'deployed', actor: 'system' })
      return result
    }),

  /** Called by agent after successful deployment */
  markDeployed: agentProcedure
    .input(
      z.object({
        id: z.string(),
        log: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.agentId !== ctx.agentId) throw new TRPCError({ code: 'FORBIDDEN' })
      const result = await updateUpdateResultStatus(input.id, 'deployed', {
        deployedAt: new Date(),
        deployLog: input.log ?? null,
        // Capture currentTag as previousTag for future rollback
        previousTag: update.currentTag,
      })
      await createAuditEntry({
        updateResultId: input.id,
        action: 'deployed',
        actor: 'agent',
        detail: input.log ?? null,
      })
      return result
    }),

  /** Called by agent when deployment failed */
  markFailed: agentProcedure
    .input(
      z.object({
        id: z.string(),
        log: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.agentId !== ctx.agentId) throw new TRPCError({ code: 'FORBIDDEN' })
      const result = await updateUpdateResultStatus(input.id, 'failed', {
        deployLog: input.log ?? null,
      })
      await createAuditEntry({
        updateResultId: input.id,
        action: 'failed',
        actor: 'agent',
        detail: input.log ?? null,
      })
      return result
    }),

  /** Get audit log for a specific update */
  getAuditLog: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return findAuditLogByUpdateResult(input.id)
    }),

  /** Get full audit log (all updates, last 200 entries) */
  listAuditLog: adminProcedure.query(async () => {
    return findAllAuditLogWithAgent(200)
  }),

  /** Get paginated audit log */
  listAuditLogPage: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const { entries, total } = await findAuditLogPage(input)
      const totalPages = Math.max(1, Math.ceil(total / input.pageSize))
      return { entries, total, page: input.page, pageSize: input.pageSize, totalPages }
    }),

  /** Request rollback — reverts a deployed update to its previous tag */
  rollback: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.status !== 'deployed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only deployed updates can be rolled back',
        })
      }
      if (!update.previousTag) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No previous tag recorded — cannot roll back',
        })
      }
      const result = await updateUpdateResultStatus(input.id, 'rollback_requested')
      await createAuditEntry({
        updateResultId: input.id,
        action: 'rollback_requested',
        actor: 'admin',
      })
      return result
    }),

  /** Called by agent after successful rollback */
  markRolledBack: agentProcedure
    .input(z.object({ id: z.string(), log: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.agentId !== ctx.agentId) throw new TRPCError({ code: 'FORBIDDEN' })
      const result = await updateUpdateResultStatus(input.id, 'rolled_back', {
        deployLog: input.log ?? null,
      })
      await createAuditEntry({
        updateResultId: input.id,
        action: 'rollback_completed',
        actor: 'agent',
        detail: input.log ?? null,
      })
      return result
    }),

  /** Called by agent when rollback failed */
  markRollbackFailed: agentProcedure
    .input(z.object({ id: z.string(), log: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const update = await findUpdateResultById(input.id)
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' })
      if (update.agentId !== ctx.agentId) throw new TRPCError({ code: 'FORBIDDEN' })
      const result = await updateUpdateResultStatus(input.id, 'failed', {
        deployLog: input.log ?? null,
      })
      await createAuditEntry({
        updateResultId: input.id,
        action: 'rollback_failed',
        actor: 'agent',
        detail: input.log ?? null,
      })
      return result
    }),
})
