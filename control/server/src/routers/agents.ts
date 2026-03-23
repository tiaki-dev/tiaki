import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure, agentProcedure } from '../trpc.js'
import {
  findAllAgents,
  findAgentById,
  createAgent,
  deleteAgent,
  updateAgentLastSeen,
  renameAgent,
} from '../db/queries/agents.js'
import { generateApiKey, hashApiKey, extractKeyPrefix } from '../lib/api-key.js'
import { newId } from '../lib/id.js'

export const agentsRouter = router({
  /** Register a new agent — returns plain-text API key (shown once) */
  register: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(['vm', 'k8s']),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const apiKey = generateApiKey()
      const apiKeyHash = await hashApiKey(apiKey)

      const agent = await createAgent({
        id: newId(),
        name: input.name,
        type: input.type,
        apiKeyHash,
        keyPrefix: extractKeyPrefix(apiKey),
        status: 'unknown',
        metadata: input.description ? { description: input.description } : {},
      })

      return { agentId: agent.id, apiKey }
    }),

  /** List all agents (UI) */
  list: adminProcedure.query(async () => {
    return findAllAgents()
  }),

  /** Get a single agent */
  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const agent = await findAgentById(input.id)
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND' })
      return agent
    }),

  /** Agent heartbeat — updates last_seen_at (handled in auth middleware too, but explicit call is cleaner) */
  heartbeat: agentProcedure.mutation(async ({ ctx }) => {
    await updateAgentLastSeen(ctx.agentId!)
    return { ok: true }
  }),

  /** Rename an agent */
  rename: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const agent = await findAgentById(input.id)
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND' })
      return renameAgent(input.id, input.name)
    }),

  /** Delete an agent and all associated containers + updates */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const agent = await findAgentById(input.id)
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND' })
      await deleteAgent(input.id)
      return { ok: true }
    }),
})
