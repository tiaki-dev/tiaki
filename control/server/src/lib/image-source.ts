/**
 * Fetch the `org.opencontainers.image.source` OCI label from a Docker Hub image manifest.
 * Falls back to extracting a GitHub URL from the Docker Hub repository description.
 * Returns a GitHub source URL, or null if unavailable.
 */

interface DockerManifest {
  config?: { digest: string }
}

interface DockerConfig {
  config?: { Labels?: Record<string, string> }
}

interface DockerHubRepo {
  full_description?: string
}

/**
 * Known upstream GitHub repos for popular Docker Hub official images.
 * Key: normalized docker repo (e.g. "library/nginx").
 * Value: GitHub "owner/repo".
 */
const KNOWN_UPSTREAM: Record<string, string> = {
  'library/nginx': 'nginx/nginx',
  'library/traefik': 'traefik/traefik',
  'library/grafana': 'grafana/grafana',
  'library/mysql': 'mysql/mysql-server',
  'library/mariadb': 'MariaDB/server',
  'library/mongo': 'mongodb/mongo',
  'library/node': 'nodejs/node',
  'library/golang': 'golang/go',
  'library/python': 'python/cpython',
  'library/alpine': 'alpinelinux/aports',
  'library/ubuntu': 'ubuntu/ubuntu-packaging',
  'library/caddy': 'caddyserver/caddy',
  'library/haproxy': 'haproxy/haproxy',
  'library/memcached': 'memcached/memcached',
  'library/rabbitmq': 'rabbitmq/rabbitmq-server',
  'library/elasticsearch': 'elastic/elasticsearch',
  'library/kibana': 'elastic/kibana',
}

/** Normalize image name to `owner/repo` form for docker.io. */
function normalizeDockerRepo(image: string): string {
  if (image.startsWith('docker.io/')) image = image.slice(10)
  if (image.startsWith('registry-1.docker.io/')) image = image.slice(21)
  return image.includes('/') ? image : `library/${image}`
}

async function getDockerToken(repo: string): Promise<string | null> {
  try {
    const scope = `repository:${repo}:pull`
    const resp = await fetch(
      `https://auth.docker.io/token?service=registry.docker.io&scope=${encodeURIComponent(scope)}`,
      { signal: AbortSignal.timeout(8_000) },
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as { token?: string }
    return data.token ?? null
  } catch {
    return null
  }
}

/** Extract the first GitHub repo URL (owner/repo only) from a markdown description. */
function extractGithubUrl(text: string): string | null {
  const match = text.match(/https:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/)
  if (!match) return null
  // Strip trailing path segments — we only want owner/repo
  const [owner, repo] = match[1]!.split('/')
  return `https://github.com/${owner}/${repo}`
}

/** Fallback: look up Docker Hub repository description and extract a GitHub URL. */
async function getSourceUrlFromDockerHub(repo: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://hub.docker.com/v2/repositories/${repo}/`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as DockerHubRepo
    return data.full_description ? extractGithubUrl(data.full_description) : null
  } catch {
    return null
  }
}

export async function getImageSourceUrl(image: string, tag: string): Promise<string | null> {
  // Non-docker.io registries: derive GitHub URL from the image path heuristically
  const hasRegistry =
    image.includes('/') && (image.includes('.') || image.includes(':'))
  if (hasRegistry) {
    const parts = image.split('/')
    if (parts.length >= 3) {
      const [, owner, repo] = parts
      return `https://github.com/${owner}/${repo}`
    }
    return null
  }

  const repo = normalizeDockerRepo(image)

  // Check known upstream mapping first — avoids slow manifest + Hub API calls
  if (KNOWN_UPSTREAM[repo]) {
    return `https://github.com/${KNOWN_UPSTREAM[repo]}`
  }

  const token = await getDockerToken(repo)
  if (!token) return null

  // 1. Try OCI label from the image manifest
  try {
    const manifestResp = await fetch(
      `https://registry-1.docker.io/v2/${repo}/manifests/${tag}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: [
            'application/vnd.oci.image.manifest.v1+json',
            'application/vnd.docker.distribution.manifest.v2+json',
          ].join(', '),
        },
        signal: AbortSignal.timeout(8_000),
      },
    )
    if (manifestResp.ok) {
      const manifest = (await manifestResp.json()) as DockerManifest
      const configDigest = manifest.config?.digest
      if (configDigest) {
        const configResp = await fetch(
          `https://registry-1.docker.io/v2/${repo}/blobs/${configDigest}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) },
        )
        if (configResp.ok) {
          const config = (await configResp.json()) as DockerConfig
          const label = config.config?.Labels?.['org.opencontainers.image.source']
          if (label) return label
        }
      }
    }
  } catch {
    // fall through to Docker Hub description fallback
  }

  // 2. Fallback: Docker Hub repository description
  return getSourceUrlFromDockerHub(repo)
}
