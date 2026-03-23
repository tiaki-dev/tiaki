# tiakidev/tiaki-server

The Tiaki control plane — a web UI and API server for centralized container update management.

## What is Tiaki?

[Tiaki](https://github.com/tiaki-dev/tiaki) monitors your running containers, detects available updates, and automates deployments with built-in rollback capabilities.

## Quick Start

```bash
# 1. Download the compose file and example env
curl -O https://raw.githubusercontent.com/tiaki-dev/tiaki/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/tiaki-dev/tiaki/main/.env.example

# 2. Create your .env and set a secret admin token
cp .env.example .env
# Generate a token: openssl rand -hex 32
# Set ADMIN_TOKEN=<generated-token> in .env

# 3. Start Tiaki
docker compose up -d
```

Open **http://localhost:3001** and log in with your `ADMIN_TOKEN`.

## Environment Variables

| Variable                                                            | Required | Description                                                         |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `ADMIN_TOKEN`                                                       | ✅       | Secret token for the admin UI. Generate with `openssl rand -hex 32` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | —        | Email notification settings                                         |
| `SCAN_INTERVAL`                                                     | —        | Cron expression for scan frequency (default: `0 */6 * * *`)         |
| `ANTHROPIC_API_KEY`                                                 | —        | Enables AI-powered release notes summarization                      |
| `GITHUB_TOKEN`                                                      | —        | Higher GitHub API rate limits for fetching release notes            |

## Architecture

Tiaki uses a distributed architecture:

- **tiaki-server** — TypeScript/Node.js web app with React frontend and tRPC API, backed by PostgreSQL
- **tiaki-agent-docker** — Lightweight Go agent for Docker Compose / VM environments
- **tiaki-agent-k8s** — Lightweight Go agent for Kubernetes clusters

## Links

- [Website](https://tiaki.dev)
- [Documentation](https://docs.tiaki.dev)
- [GitHub Repository](https://github.com/tiaki-dev/tiaki)
- [Changelog](https://github.com/tiaki-dev/tiaki/blob/main/CHANGELOG.md)
- [Report an Issue](https://github.com/tiaki-dev/tiaki/issues)
