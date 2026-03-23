/**
 * Validates that a URL is safe to send outbound HTTP requests to.
 * Blocks private/internal IP ranges to prevent SSRF attacks.
 *
 * Covers: loopback, RFC 1918, link-local, AWS/GCP metadata endpoints.
 */

const BLOCKED_PATTERNS = [
  // Loopback
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^\[?::1\]?$/,
  // RFC 1918 private ranges
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  // Link-local / metadata (AWS, GCP, Azure IMDS)
  /^169\.254\.\d+\.\d+$/,
  // IPv6 private (fc00::/7)
  /^\[?f[cd][0-9a-f]{2}:/i,
  // Unspecified
  /^0\.0\.0\.0$/,
]

export function validateOutboundUrl(raw: string): void {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`Invalid URL: ${raw}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Disallowed URL scheme: ${parsed.protocol}`)
  }

  const hostname = parsed.hostname
  if (!hostname) {
    throw new Error('URL has no hostname')
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`URL targets a private/internal address and is not allowed: ${hostname}`)
    }
  }
}
