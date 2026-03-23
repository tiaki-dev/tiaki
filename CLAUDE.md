# Tiaki – Claude Code Guide

Tiaki is a distributed container update management system: lightweight **Go agents** that run on infrastructure + a **TypeScript control plane** for centralized management.

## Repository Layout

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
│       ├── registry/       # Docker registry client (update checks)
│       ├── reporter/       # Control plane HTTP reporter
│       └── trivy/          # Trivy vulnerability scanner
├── control/
│   ├── client/             # React + Vite frontend (TailwindCSS, shadcn/ui)
│   ├── server/             # tRPC + Express API (Drizzle ORM, PostgreSQL)
│   └── e2e/                # Playwright E2E tests
├── e2e/                    # Shell-based integration test scripts
└── proto/api.yaml          # OpenAPI contract (agent ↔ control plane)
```

## Development Commands

### Control Plane (run from `control/`)

```bash
pnpm install                         # install all workspace deps (pnpm 9)
docker-compose -f docker-compose.dev.yml up -d   # start PostgreSQL
pnpm db:migrate                      # run Drizzle migrations
pnpm dev                             # start server (:3001) + client (:3000) concurrently
pnpm build                           # production build
pnpm test                            # server unit tests (Vitest)
pnpm test:e2e                        # Playwright E2E tests
pnpm db:generate                     # generate Drizzle migration files
pnpm db:studio                       # open Drizzle Studio
```

### Agent (run from `agent/`)

```bash
go test ./...                                          # run all tests
go test -coverprofile=coverage.out ./...               # with coverage
go test -v ./internal/registry                         # single package
go build -o bin/tiaki-agent-docker ./cmd/docker        # build Docker agent
go build -o bin/tiaki-agent-k8s ./cmd/k8s              # build K8s agent
go vet ./...                                           # lint
gofmt -w .                                             # format
```

### E2E Integration Tests (run from `e2e/`)

```bash
./run-e2e-audit.sh      # Docker Compose agent E2E
./run-e2e-k8s.sh        # Kubernetes agent E2E
./run-e2e-rollback.sh   # Rollback E2E
```

## Architecture Notes

- **Agent → Control plane** communication is REST (defined in `proto/api.yaml`). Key endpoints:
  - `POST /api/v1/agents/register` – initial registration, returns API key
  - `POST /api/v1/agents/heartbeat`
  - `POST /api/v1/reports/submit` – container scan results
  - `GET /api/v1/reports/commands` – long-poll for deployment commands
  - `POST /api/v1/reports/commands/{id}/result`
- **tRPC** is used only for the browser UI ↔ server communication.
- Agents authenticate with a **Bearer API key** (hashed in DB with `argon2`). See `control/server/src/trpc.ts`.
- **Drizzle ORM** handles schema + migrations in `control/server/src/db/`.
- Registry update checks live in `agent/internal/registry/`. Semver tags use tag comparison; non-semver tags (e.g. `latest`) use digest comparison.

## Key Configuration

### Agent (env vars)
| Variable | Description |
|---|---|
| `CONTROL_URL` | Control plane URL |
| `API_KEY` | Bearer token from registration |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | Private registry creds |
| `TRIVY_ENABLED` | Enable Trivy scanning (`false`) |
| `TRIVY_MIN_SEVERITY` | `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` |
| `GIT_ENABLED` | Commit compose file changes |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` / `GIT_COMMIT_MSG` | Git commit config |

### Control Plane (`control/server/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (32+ chars) |
| `PORT` | API port (default `3001`) |
| `SMTP_*` | Email notifications (optional) |
| `SCAN_INTERVAL` | Cron schedule (default `0 */6 * * *`) |
| `ANTHROPIC_API_KEY` | AI changelog analysis (optional) |
| `GITHUB_TOKEN` | Enhanced release notes (optional) |

## Coding Standards

### Go
- Follow [Effective Go](https://golang.org/doc/effective_go); run `gofmt` + `go vet` before committing
- Comment all exported types and functions
- Wrap errors with `fmt.Errorf("context: %w", err)` — never swallow errors
- Maintain >80% test coverage; prefer pure functions for testability (see `checkForUpdateDigest`)
- Module path: `github.com/itlabs-gmbh/tiaki/agent`

### TypeScript
- Strict mode; follow ESLint config
- Functional React components and hooks only
- `const` > `let`; async/await over promise chains
- Use Drizzle query builder; avoid raw SQL unless necessary
- Package manager: **pnpm** (not npm/yarn)

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Scopes: `agent`, `control`, `registry`, `k8s`, `docker`, `e2e`
