import cron from 'node-cron'
import { markStaleAgentsOffline } from '../db/queries/agents.js'
import { findAllUpdateResults } from '../db/queries/update-results.js'
import { createNotification, updateNotificationStatus } from '../db/queries/notifications.js'
import { sendWebhook, getConfiguredWebhookUrls } from '../notify/webhook.js'
import { sendNtfy, getNtfyConfig } from '../notify/ntfy.js'
import { newId } from '../lib/id.js'

const AGENT_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

// Track which update IDs we've already notified about (in-memory, resets on restart)
const notifiedUpdateIds = new Set<string>()

export { fireWebhooksForNewUpdates, fireNtfyForNewUpdates }

export function startScheduler(): void {
  // Every minute: mark agents offline if no heartbeat for 5 minutes
  cron.schedule('* * * * *', async () => {
    try {
      await markStaleAgentsOffline(AGENT_OFFLINE_THRESHOLD_MS)
    } catch (err) {
      console.error('[scheduler] failed to mark stale agents', err)
    }
  })

  // Every 5 minutes: fire notifications for new pending updates
  cron.schedule('*/5 * * * *', async () => {
    try {
      await fireWebhooksForNewUpdates()
      await fireNtfyForNewUpdates()
    } catch (err) {
      console.error('[scheduler] notification job failed', err)
    }
  })

  console.log('[scheduler] started')
}

async function fireWebhooksForNewUpdates(): Promise<void> {
  const webhookUrls = getConfiguredWebhookUrls()
  if (webhookUrls.length === 0) return

  const pending = await findAllUpdateResults({ status: 'pending' })
  const newUpdates = pending.filter((u) => !notifiedUpdateIds.has(u.id))
  if (newUpdates.length === 0) return

  for (const url of webhookUrls) {
    const notifId = newId()
    await createNotification({
      id: notifId,
      type: 'webhook',
      recipient: url,
      updateResultIds: newUpdates.map((u) => u.id),
      status: 'pending',
      sentAt: null,
      error: null,
    })

    const err = await sendWebhook(url, newUpdates)
    if (err) {
      console.error(`[scheduler] webhook failed for ${url}: ${err}`)
      await updateNotificationStatus(notifId, 'failed', err)
    } else {
      console.log(`[scheduler] webhook sent to ${url}: ${newUpdates.length} updates`)
      await updateNotificationStatus(notifId, 'sent')
      newUpdates.forEach((u) => notifiedUpdateIds.add(u.id))
    }
  }
}

async function fireNtfyForNewUpdates(): Promise<void> {
  const ntfy = getNtfyConfig()
  if (!ntfy) return

  const pending = await findAllUpdateResults({ status: 'pending' })
  const newUpdates = pending.filter((u) => !notifiedUpdateIds.has(u.id))
  if (newUpdates.length === 0) return

  const notifId = newId()
  const recipient = `${ntfy.url}/${ntfy.topic}`
  await createNotification({
    id: notifId,
    type: 'ntfy',
    recipient,
    updateResultIds: newUpdates.map((u) => u.id),
    status: 'pending',
    sentAt: null,
    error: null,
  })

  const ntfyPayload = newUpdates.map((u) => ({
    image: u.containerId, // containerId (DB UUID) — good enough for notification text
    currentTag: u.currentTag,
    latestTag: u.latestTag,
  }))

  const err = await sendNtfy(ntfy.url, ntfy.topic, ntfyPayload)
  if (err) {
    console.error(`[scheduler] ntfy failed for ${recipient}: ${err}`)
    await updateNotificationStatus(notifId, 'failed', err)
  } else {
    console.log(`[scheduler] ntfy sent to ${recipient}: ${newUpdates.length} updates`)
    await updateNotificationStatus(notifId, 'sent')
    newUpdates.forEach((u) => notifiedUpdateIds.add(u.id))
  }
}
