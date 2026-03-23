import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../trpc.js'
import { findAllPoliciesWithAgent, findPolicyById, createPolicy, updatePolicy, deletePolicy, type PolicyUpdate } from '../db/queries/policies.js'
import { newId } from '../lib/id.js'

export const policiesRouter = router({
  list: adminProcedure.query(async () => {
    return findAllPoliciesWithAgent()
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        agentId: z.string().optional(),
        imagePattern: z.string().min(1),
        autoApprove: z.boolean().default(false),
        maxBump: z.enum(['patch', 'minor', 'major']).nullable().default(null),
        notifyChannels: z.array(z.string()).default([]),
        enabled: z.boolean().default(true),
        priority: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      return createPolicy({
        id: newId(),
        name: input.name,
        agentId: input.agentId ?? null,
        imagePattern: input.imagePattern,
        autoApprove: input.autoApprove,
        maxBump: input.maxBump,
        notifyChannels: input.notifyChannels,
        enabled: input.enabled,
        priority: input.priority,
        createdAt: new Date(),
      })
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        agentId: z.string().nullable().optional(),
        imagePattern: z.string().min(1).optional(),
        autoApprove: z.boolean().optional(),
        maxBump: z.enum(['patch', 'minor', 'major']).nullable().optional(),
        notifyChannels: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        priority: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await findPolicyById(input.id)
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
      const data: PolicyUpdate = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.agentId !== undefined && { agentId: input.agentId }),
        ...(input.imagePattern !== undefined && { imagePattern: input.imagePattern }),
        ...(input.autoApprove !== undefined && { autoApprove: input.autoApprove }),
        ...(input.maxBump !== undefined && { maxBump: input.maxBump }),
        ...(input.notifyChannels !== undefined && { notifyChannels: input.notifyChannels }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.priority !== undefined && { priority: input.priority }),
      }
      return updatePolicy(input.id, data)
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const existing = await findPolicyById(input.id)
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
      await deletePolicy(input.id)
      return { ok: true }
    }),
})
