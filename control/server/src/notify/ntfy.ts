import { validateOutboundUrl } from '../lib/validate-url.js'

/**
 * Send a push notification to an ntfy server/topic.
 * Protocol: PUT https://<server>/<topic>  (plain-text body)
 * See: https://ntfy.sh/docs/publish/
 */
export async function sendNtfy(
  url: string,
  topic: string,
  updates: Array<{ image: string; currentTag: string; latestTag: string }>,
): Promise<string | undefined> {
  const count = updates.length
  const title = `Tiaki: ${count} update${count !== 1 ? 's' : ''} available`
  const lines = updates.map((u) => `• ${u.image}: ${u.currentTag} → ${u.latestTag}`)
  const message = lines.join('\n')

  const endpoint = `${url.replace(/\/$/, '')}/${topic}`
  try {
    validateOutboundUrl(endpoint)
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        Title: title,
        Priority: 'default',
        Tags: 'package',
      },
      body: message,
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

/** Read NTFY_URL + NTFY_TOPIC env vars. Returns null if either is missing. */
export function getNtfyConfig(): { url: string; topic: string } | null {
  const url = process.env['NTFY_URL'] ?? ''
  const topic = process.env['NTFY_TOPIC'] ?? ''
  if (!url || !topic) return null
  return { url, topic }
}
