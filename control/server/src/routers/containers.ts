import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../trpc.js'
import { findAllContainersWithAgent, findContainerById } from '../db/queries/containers.js'

export const containersRouter = router({
  list: adminProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        image: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      return findAllContainersWithAgent(input ?? {})
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const container = await findContainerById(input.id)
      if (!container) throw new TRPCError({ code: 'NOT_FOUND' })
      return container
    }),
})
