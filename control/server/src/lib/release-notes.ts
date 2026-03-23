/**
 * Fetch GitHub release notes for a given source URL + tag.
 * Tries multiple tag variants to handle format differences between Docker Hub
 * and GitHub (e.g. "1.27.4-alpine" → "release-1.27.4", "v1.27.4", etc.)
 */

interface GitHubRelease {
  body?: string
  html_url: string
}

export interface ReleaseInfo {
  body: string
  url: string
}

/** Generate candidate tag names to try against the GitHub Releases API. */
function tagCandidates(tag: string): string[] {
  // Strip common variant suffixes: -alpine, -alpine3.20, -bookworm, -slim, etc.
  const bare = tag.replace(/-(?:alpine[\d.]*|debian|bookworm|bullseye|buster|slim|perl|otel|fpm|unprivileged).*$/i, '')

  const candidates = new Set<string>()
  for (const t of [tag, bare]) {
    candidates.add(t)             // 1.27.4-alpine, 1.27.4
    candidates.add(`v${t}`)       // v1.27.4-alpine, v1.27.4
    candidates.add(`release-${t}`) // release-1.27.4
  }
  return [...candidates]
}

async function fetchRelease(
  owner: string,
  repo: string,
  tag: string,
  headers: Record<string, string>,
): Promise<ReleaseInfo | null> {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
      { headers, signal: AbortSignal.timeout(8_000) },
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as GitHubRelease
    if (!data.html_url) return null
    return { body: data.body ?? '', url: data.html_url }
  } catch {
    return null
  }
}

export async function fetchReleaseNotes(
  sourceUrl: string,
  tag: string,
): Promise<ReleaseInfo | null> {
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/)
  if (!match) return null
  const owner = match[1]!
  const repo = match[2]!

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Tiaki/1.0',
  }
  if (process.env['GITHUB_TOKEN']) {
    headers['Authorization'] = `Bearer ${process.env['GITHUB_TOKEN']}`
  }

  for (const candidate of tagCandidates(tag)) {
    const result = await fetchRelease(owner, repo, candidate, headers)
    if (result) return result
  }
  return null
}
