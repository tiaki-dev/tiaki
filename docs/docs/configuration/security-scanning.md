---
sidebar_position: 6
---

# Security Scanning

Tiaki integrates with [Trivy](https://trivy.dev/) to scan container images for known vulnerabilities before and after deployments.

## How it works

When Trivy is enabled, the agent scans each container image during its regular update check cycle. Scan results are reported to the control plane and visible in the dashboard alongside update information.

## Enabling Trivy

Set these environment variables on the agent:

```env title=".env"
TRIVY_ENABLED=true
TRIVY_MIN_SEVERITY=HIGH
```

Restart the agent after changing these values.

## Severity levels

The `TRIVY_MIN_SEVERITY` variable controls which vulnerabilities are reported:

| Value | Reported severities |
|---|---|
| `CRITICAL` | Critical only |
| `HIGH` | High and Critical |
| `MEDIUM` | Medium, High, and Critical |
| `LOW` | All vulnerabilities |

Default is `HIGH`.

## Disk space requirements

Trivy downloads its vulnerability database on first run (~200 MB) and updates it periodically. Ensure the agent container or host has sufficient disk space.

When running as a Docker container, mount a volume to persist the Trivy cache:

```yaml title="docker-compose.yml"
agent:
  image: ghcr.io/tiaki-dev/tiaki-agent-docker:latest
  environment:
    TRIVY_ENABLED: "true"
    TRIVY_MIN_SEVERITY: HIGH
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - trivy-cache:/root/.cache/trivy

volumes:
  trivy-cache:
```

## Network requirements

The agent needs outbound HTTPS access to download the Trivy vulnerability database from:
- `ghcr.io` (Trivy DB images)
- `db.trivy.aquasec.com` (fallback)

## Viewing scan results

Vulnerability reports are shown in the Tiaki dashboard:

1. Go to **Containers**
2. Click on any container
3. The **Security** tab shows detected vulnerabilities with CVE IDs, severity, and affected packages

## Performance impact

Trivy scanning adds time to each scan cycle, depending on image size. For large images (>1 GB), expect scans to take 1–3 minutes per image on first run. Subsequent scans are faster due to layer caching.

To reduce impact, consider increasing `SCAN_INTERVAL` on the control plane when Trivy is enabled.
