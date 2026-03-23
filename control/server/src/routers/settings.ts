import { router, adminProcedure } from '../trpc.js'

/** Return only the origin (scheme + host) of a URL, hiding paths that may contain tokens. */
function urlOrigin(raw: string): string {
  try {
    return new URL(raw).origin
  } catch {
    return ''
  }
}

/** Mask a string to show only the last 4 characters, e.g. "●●●●●●abcd". */
function maskEnd(value: string): string {
  if (value.length <= 4) return '●'.repeat(value.length)
  return '●'.repeat(Math.min(value.length - 4, 8)) + value.slice(-4)
}

// In MVP, settings are environment-variable based.
// This router exposes them read-only (masking secrets and partial-masking sensitive values).
export const settingsRouter = router({
  get: adminProcedure.query(() => {
    const ntfyTopic = process.env['NTFY_TOPIC'] ?? ''
    const webhookUrls = (process.env['WEBHOOK_URLS'] ?? '')
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'))

    return {
      smtp: {
        host: process.env['SMTP_HOST'] ?? '',
        port: Number.parseInt(process.env['SMTP_PORT'] ?? '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        user: process.env['SMTP_USER'] ?? '',
        from: process.env['SMTP_FROM'] ?? '',
        configured: Boolean(process.env['SMTP_HOST']),
      },
      ntfy: {
        url: process.env['NTFY_URL'] ?? '',
        topic: ntfyTopic ? maskEnd(ntfyTopic) : '',
        configured: Boolean(process.env['NTFY_URL'] && ntfyTopic),
      },
      webhook: {
        // Show only origins — webhook paths often contain signing tokens
        urls: webhookUrls.map(urlOrigin).filter(Boolean),
        count: webhookUrls.length,
        configured: webhookUrls.length > 0,
      },
      scanInterval: process.env['SCAN_INTERVAL'] ?? '0 */6 * * *',
    }
  }),
})
