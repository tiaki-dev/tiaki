---
sidebar_position: 1
---

# Architecture

Tiaki consists of two independently deployable components that communicate over a REST API.

## System overview

```
Browser
  │
  │ tRPC (TypeScript)
  ▼
┌─────────────────────────────────────┐
│          Control Plane              │
│  ┌────────────┐  ┌───────────────┐  │
│  │   React    │  │  Express/tRPC │  │
│  │  Frontend  │  │  API Server   │  │
│  └────────────┘  └──────┬────────┘  │
│                         │           │
│                  ┌──────▼────────┐  │
│                  │  PostgreSQL   │  │
│                  └───────────────┘  │
└─────────────────────┬───────────────┘
                      │ REST (proto/api.yaml)
           ┌──────────┴──────────┐
           ▼                     ▼
  ┌─────────────────┐   ┌─────────────────┐
  │  Docker Agent   │   │   K8s Agent     │
  │  (Go binary)    │   │  (Go binary)    │
  └────────┬────────┘   └────────┬────────┘
           │                     │
    Docker socket           K8s API server
    (local/remote)          (in-cluster)
```

## Control plane (`control/`)

Built with TypeScript/Node.js, the control plane has two sub-packages:

### Server (`control/server/`)

- **Framework**: Express.js with [tRPC](https://trpc.io/) for type-safe browser ↔ server communication
- **Database**: PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: Bearer token authentication for agents; JWT sessions for the web UI
- **Scheduler**: Cron-based scan trigger using the `SCAN_INTERVAL` env var
- **Notifications**: SMTP email via Nodemailer

Key files:
- `src/index.ts` — Express app setup, routes, middleware
- `src/trpc.ts` — tRPC router and agent auth middleware
- `src/routers/` — tRPC procedure definitions (agents, containers, updates, deployments)
- `src/db/` — Drizzle schema and migrations
- `src/scheduler/` — Cron job for triggering scans

### Client (`control/client/`)

- **Framework**: React + Vite
- **Styling**: TailwindCSS + [shadcn/ui](https://ui.shadcn.com/)
- **State**: React Query (via tRPC client)

## Agents (`agent/`)

Written in Go 1.23. Two separate binaries share most internal packages:

| Package | Responsibility |
|---|---|
| `cmd/docker` | Docker agent entrypoint |
| `cmd/k8s` | Kubernetes agent entrypoint |
| `internal/config` | Env-based configuration parsing |
| `internal/docker` | Docker SDK wrapper — list containers, pull images, restart services |
| `internal/k8s` | Kubernetes client wrapper — list pods/deployments, update image refs |
| `internal/registry` | Docker registry client — check for newer tags/digests |
| `internal/reporter` | HTTP client for control plane REST API |
| `internal/executor` | Deployment execution logic |
| `internal/compose` | Docker Compose file parsing and updating |
| `internal/git` | Git commit integration |
| `internal/trivy` | Trivy vulnerability scanner integration |

## Agent lifecycle

```
Agent start
    │
    ▼
Register with control plane
(POST /api/v1/agents/register)
    │
    ▼
┌─────────────────────────────────┐
│         Main loop               │
│                                 │
│  1. Scan containers             │
│  2. Check registries for updates│
│  3. Submit report               │
│     (POST /api/v1/reports/submit)│
│                                 │
│  4. Long-poll for commands      │
│     (GET /api/v1/reports/commands│
│      30s timeout)               │
│                                 │
│  5. If command received:        │
│     - Pull new image            │
│     - Update compose file       │
│     - Restart container         │
│     - Report result             │
│     - Optional: git commit      │
│                                 │
│  6. Send heartbeat              │
│  7. Wait for next scan interval │
└─────────────────────────────────┘
```

## Update detection logic

The registry package uses two strategies depending on the image tag:

- **Semver tags** (e.g. `v1.2.3`, `1.25`): compares semantic versions, reports when a newer version exists
- **Non-semver tags** (e.g. `latest`, `stable`, `main`): compares image digests (SHA256), reports when the digest has changed

## Authentication

- **Agent → Control plane**: Bearer token (API key) issued at registration, stored hashed in PostgreSQL using argon2
- **Browser → Control plane**: JWT session token, issued after login with `ADMIN_TOKEN`

## Data flow: deployment

```
User clicks "Deploy" in dashboard
    │
    ▼ (tRPC mutation)
Control plane creates DeployCommand record in DB
    │
    ▼ (long-poll response)
Agent receives DeployCommand
    │
    ├── Pull new image from registry
    ├── Update docker-compose.yml (if applicable)
    ├── docker compose up -d <service>
    └── POST /api/v1/reports/commands/{id}/result
            │
            ▼
    Control plane updates DB, sends notification email
```
