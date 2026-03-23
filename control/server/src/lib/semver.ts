export type BumpType = 'patch' | 'minor' | 'major' | 'unknown'
export type MaxBump = 'patch' | 'minor' | 'major'

// Extracts leading semver digits from a tag like "1.29.6-alpine" → [1, 29, 6]
function parseSemver(tag: string): [number, number, number] | null {
  const match = tag.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return null
  return [
    parseInt(match[1] ?? '0', 10),
    parseInt(match[2] ?? '0', 10),
    parseInt(match[3] ?? '0', 10),
  ]
}

export function getBumpType(from: string, to: string): BumpType {
  const a = parseSemver(from)
  const b = parseSemver(to)
  if (!a || !b) return 'unknown'

  if (b[0] > a[0]) return 'major'
  if (b[1] > a[1]) return 'minor'
  if (b[2] > a[2]) return 'patch'
  return 'unknown'
}

const BUMP_RANK: Record<MaxBump, number> = { patch: 0, minor: 1, major: 2 }

export function isBumpAllowed(bump: BumpType, maxBump: MaxBump | null): boolean {
  if (!maxBump) return true
  if (bump === 'unknown') return true
  return BUMP_RANK[bump] <= BUMP_RANK[maxBump]
}
