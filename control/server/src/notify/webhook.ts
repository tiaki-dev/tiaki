import type { UpdateResult } from '../db/schema.js'
import { validateOutboundUrl } from '../lib/validate-url.js'

export interface WebhookPayload {
  event: 'updates.found'
  ts: string
  updates: Array<{
    id: string
    image: string
    currentTag: string
    latestTag: string
    status: string
    agentId: string
  }>
}

/**
 * Send a webhook POST to the given URL with a JSON payload.
 * Returns an error string on failure, undefined on success.
 */
export async function sendWebhook(
  url: string,
  updates: UpdateResult[],
): Promise<string | undefined> {
  const payload: WebhookPayload = {
    event: 'updates.found',
    ts: new Date().toISOString(),
    updates: updates.map((u) => ({
      id: u.id,
      image: u.containerId, // containerId here is DB uuid — callers should JOIN; ok for MVP
      currentTag: u.currentTag,
      latestTag: u.latestTag,
      status: u.status,
      agentId: u.agentId,
    })),
  }

  try {
    validateOutboundUrl(url)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      return `HTTP ${res.status}: ${await res.text().catch(() => '')}`
    }
    return undefined
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/** Parse WEBHOOK_URLS env var (comma-separated list of URLs). */
export function getConfiguredWebhookUrls(): string[] {
  const raw = process.env['WEBHOOK_URLS'] ?? ''
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'))
}
