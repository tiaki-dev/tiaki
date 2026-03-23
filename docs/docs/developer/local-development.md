---
sidebar_position: 2
---

# Local Development

## Prerequisites

- [Go 1.23+](https://go.dev/dl/)
- [Node.js 24](https://nodejs.org/) (use [nvm](https://github.com/nvm-sh/nvm): `nvm use`)
- [pnpm 9](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose

## Control plane

```bash
cd control

# Install all workspace dependencies
pnpm install

# Start PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Run database migrations
pnpm db:migrate

# Start both server (:3001) and client (:3000) concurrently
pnpm dev
```

Open the dashboard at **http://localhost:3000**.

### Useful commands

```bash
# Run unit tests (Vitest)
pnpm test

# Generate a new Drizzle migration after schema changes
pnpm db:generate

# Open Drizzle Studio (database browser)
pnpm db:studio

# Production build
pnpm build
```

### Control plane environment

Copy `.env.example` to `.env` in `control/server/`:

```bash
cp control/server/.env.example control/server/.env
```

The only required variable for local development is `ADMIN_TOKEN`. The `DATABASE_URL` is pre-configured for the dev Docker Compose PostgreSQL.

## Agent

```bash
cd agent

# Run all tests
go test ./...

# Run tests with coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run tests for a single package
go test -v ./internal/registry

# Build both agent binaries
go build -o bin/tiaki-agent-docker ./cmd/docker
go build -o bin/tiaki-agent-k8s ./cmd/k8s

# Lint
go vet ./...
gofmt -w .
```

### Running the agent locally against the dev control plane

```bash
cd agent
CONTROL_URL=http://localhost:3001 AGENT_API_KEY=<key-from-ui> go run ./cmd/docker
```

## E2E integration tests

```bash
cd e2e

# Docker Compose agent E2E
./run-e2e-audit.sh

# Kubernetes agent E2E
./run-e2e-k8s.sh

# Rollback E2E
./run-e2e-rollback.sh
```

### Playwright E2E (control plane UI)

```bash
cd control
pnpm test:e2e
```

## Project structure

```
tiaki/
├── agent/                  # Go 1.23 agents
│   ├── cmd/docker/         # Docker agent entrypoint
│   ├── cmd/k8s/            # Kubernetes agent entrypoint
│   └── internal/
│       ├── compose/        # Docker Compose file handling
│       ├── config/         # Env-based configuration
│       ├── docker/         # Docker client wrapper
│       ├── executor/       # Deployment execution
│       ├── git/            # Git commit integration
│       ├── k8s/            # Kubernetes client wrapper
│       ├── registry/       # Registry update checks
│       ├── reporter/       # Control plane HTTP client
│       └── trivy/          # Trivy scanner integration
├── control/
│   ├── client/             # React + Vite frontend
│   ├── server/             # tRPC + Express API
│   └── e2e/                # Playwright E2E tests
├── e2e/                    # Shell-based integration tests
├── proto/
│   └── api.yaml            # OpenAPI contract
└── docs/                   # This documentation site
```
