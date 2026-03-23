/**
 * Summarize text using Claude Haiku via the Anthropic Messages API.
 * Returns null if ANTHROPIC_API_KEY is not set or the call fails.
 */

interface AnthropicMessage {
  content: Array<{ type: string; text: string }>
}

export async function summarizeReleaseNotes(text: string): Promise<string | null> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return null

  const prompt = `Summarize these Docker image release notes using markdown. Start directly with the content — no title, no heading. Use bullet points for individual changes. Group into **New features**, **Fixes**, **Security** if applicable. Be specific: name features, CVEs, affected components. Max 10 bullets total.\n\n${text.slice(0, 4000)}`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as AnthropicMessage
    const block = data.content[0]
    return block?.type === 'text' ? block.text : null
  } catch {
    return null
  }
}

/**
 * Truncate release notes to the first 3 lines as a fallback when ANTHROPIC_API_KEY is not set.
 */
export function truncateReleaseNotes(text: string): string {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 3)
    .join(' ')
    .slice(0, 300)
}
