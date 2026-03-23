import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../trpc.js'
import { findAllNotifications } from '../db/queries/notifications.js'
import { sendTestEmail, sendUpdateNotification } from '../notify/email.js'
import { sendNtfy, getNtfyConfig } from '../notify/ntfy.js'
import { fireWebhooksForNewUpdates, fireNtfyForNewUpdates } from '../scheduler/index.js'
import { findAllUpdateResults } from '../db/queries/update-results.js'

export const notificationsRouter = router({
  getHistory: adminProcedure.query(async () => {
    return findAllNotifications()
  }),

  sendTestMail: adminProcedure
    .input(z.object({ recipient: z.string().email() }))
    .mutation(async ({ input }) => {
      await sendTestEmail(input.recipient)
      return { ok: true }
    }),

  sendUpdateMail: adminProcedure
    .input(z.object({ recipient: z.string().email() }))
    .mutation(async ({ input }) => {
      const updates = await findAllUpdateResults({ status: 'pending' })
      if (updates.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No pending updates found',
        })
      }
      await sendUpdateNotification(updates, input.recipient)
      return { ok: true, count: updates.length }
    }),

  sendTestNtfy: adminProcedure.mutation(async () => {
    const ntfy = getNtfyConfig()
    if (!ntfy) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'ntfy not configured — set NTFY_URL and NTFY_TOPIC environment variables',
      })
    }
    const err = await sendNtfy(ntfy.url, ntfy.topic, [
      { image: 'example/app', currentTag: '1.0.0', latestTag: '1.1.0' },
    ])
    if (err) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err })
    }
    return { ok: true }
  }),

  triggerWebhookCheck: adminProcedure.mutation(async () => {
    await fireWebhooksForNewUpdates()
    return { ok: true }
  }),

  triggerNtfyCheck: adminProcedure.mutation(async () => {
    await fireNtfyForNewUpdates()
    return { ok: true }
  }),
})
