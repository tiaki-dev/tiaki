<p align="center">
  <img src="logo.svg" alt="Tiaki Logo" width="120" height="120">
</p>

<h1 align="center">Tiaki</h1>

<p align="center"><strong>Automated container update management for Docker and Kubernetes</strong></p>

Tiaki monitors your running containers, detects available updates, and automates deployments with built-in rollback capabilities. It consists of lightweight Go agents that run on your infrastructure and a TypeScript control plane for centralized management.

## Features

- 🔍 **Automatic Update Detection** - Continuously monitors container registries for new image versions
- 🚀 **Automated Deployments** - Deploy updates with a single click or configure auto-deployment
- ↩️ **One-Click Rollbacks** - Instantly revert to previous versions if issues arise
- 🔒 **Security Scanning** - Optional Trivy integration for vulnerability detection
- 📝 **Git Integration** - Automatically commit docker-compose.yml changes
- 🎯 **Multi-Environment** - Supports both Docker Compose (VM) and Kubernetes deployments
- 📊 **Audit Logging** - Complete history of all deployments and changes
- 🔔 **Email Notifications** - Stay informed about updates and deployments

## Architecture

Tiaki uses a distributed architecture:

- **Control Plane** (`control/`) - TypeScript/Node.js web application
  - React frontend with TailwindCSS and shadcn/ui
  - tRPC API server with PostgreSQL
  - Web dashboard for managing containers and updates

- **Agents** (`agent/`) - Lightweight Go binaries
  - Docker agent for VM/Docker Compose environments
  - Kubernetes agent for K8s clusters
  - Scan containers, check for updates, execute deployments

## Quick Start

### Kubernetes (Helm)

The fastest way to deploy Tiaki on Kubernetes is using Helm charts:

```bash
# Add the Tiaki Helm repository
helm repo add tiaki https://charts.tiaki.dev
helm repo update

# Install the control plane
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --namespace tiaki \
  --create-namespace

# Create an agent in the UI and get the API key, then install the agent
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set config.apiKey=YOUR_API_KEY \
  --namespace tiaki
```

See the [Kubernetes deployment guide](https://docs.tiaki.dev/deployment/kubernetes) for detailed configuration options.

### Docker Compose

#### Step 1 — Download the configuration files

Download [`docker-compose.yml`](https://raw.githubusercontent.com/tiaki-dev/tiaki/main/docker-compose.yml) and [`.env.example`](https://raw.githubusercontent.com/tiaki-dev/tiaki/main/.env.example) into a new folder, or clone the repo:

```bash
git clone https://github.com/tiaki-dev/tiaki.git
cd tiaki
```

#### Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and set a secret admin token. You can generate one with this command:

```bash
openssl rand -hex 32
```

Paste the output as the value of `ADMIN_TOKEN` in your `.env` file:

```env
ADMIN_TOKEN=paste-your-generated-secret-here
```

#### Step 3 — Start Tiaki

```bash
docker compose up -d
```

This starts:

- **PostgreSQL** — the database
- **Tiaki Server** — the web UI and API

Wait a few seconds, then open **http://localhost:3001** in your browser. You will be prompted to log in — use the `ADMIN_TOKEN` value you set in your `.env` file as the password.

#### Step 4 — Connect an agent to monitor your containers

The agent runs on any machine that has access to your Docker containers — either on the same host or remotely — and reports updates back to the dashboard. Just make sure the agent can reach the Tiaki server URL over the network.

**4a.** In the Tiaki UI, go to **Agents** and create a new agent. Copy the API key that is shown — you will only see it once.

**4b.** Add the API key to your `.env` file:

```env
AGENT_API_KEY=paste-your-api-key-here
```

**4c.** Start the agent:

```bash
docker compose --profile agent up -d agent
```

The agent will now scan your running containers and report available updates to the dashboard.

---

### Stopping Tiaki

```bash
# Stop everything (data is preserved)
docker compose --profile agent down

# Stop and delete all data (including the database)
docker compose --profile agent down -v
```

---

## Configuration

### Control Plane environment variables

| Variable                                                            | Required | Description                                                                 |
| ------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `ADMIN_TOKEN`                                                       | ✅       | Secret token for the admin UI. Generate with `openssl rand -hex 32`         |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | —        | Email notification settings                                                 |
| `SCAN_INTERVAL`                                                     | —        | Cron expression for scan frequency (default: `0 */6 * * *` = every 6 hours) |
| `ANTHROPIC_API_KEY`                                                 | —        | Enables AI-powered release notes summarization                              |
| `GITHUB_TOKEN`                                                      | —        | Higher GitHub API rate limits for fetching release notes                    |

### Agent environment variables

| Variable                                  | Required | Description                                                                          |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `CONTROL_URL`                             | ✅       | URL of the Tiaki server (set automatically in docker-compose)                        |
| `AGENT_API_KEY`                           | ✅       | API key created in the Tiaki UI                                                      |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | —        | Credentials for private container registries                                         |
| `TRIVY_ENABLED`                           | —        | Set to `true` to enable vulnerability scanning                                       |
| `TRIVY_MIN_SEVERITY`                      | —        | Minimum severity to report: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` (default: `HIGH`) |
| `GIT_COMMIT_ENABLED`                      | —        | Set to `true` to automatically commit `docker-compose.yml` changes to git            |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL`    | —        | Git commit author (defaults: `Tiaki` / `tiaki@localhost`)                            |

## Development

### Control Plane Development

```bash
cd control

# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
cd server
pnpm db:migrate

# Start development servers (in separate terminals)
cd server && pnpm dev  # API server on :3001
cd client && pnpm dev  # Frontend on :3000
```

### Agent Development

```bash
cd agent

# Run tests
go test ./...

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Build both agents
go build -o bin/tiaki-agent-docker ./cmd/docker
go build -o bin/tiaki-agent-k8s ./cmd/k8s
```

### Running E2E Tests

```bash
cd e2e

# Docker Compose E2E tests
./run-e2e-audit.sh

# Kubernetes E2E tests
./run-e2e-k8s.sh

# Rollback E2E tests
./run-e2e-rollback.sh
```

## API Documentation

The REST API contract between agents and the control plane is defined in OpenAPI format:

See `proto/api.yaml` for the complete API specification.

Key endpoints:

- `POST /api/v1/agents/register` - Register a new agent
- `POST /api/v1/agents/heartbeat` - Update agent status
- `POST /api/v1/reports/submit` - Submit container scan results
- `GET /api/v1/reports/commands` - Long-poll for deployment commands
- `POST /api/v1/reports/commands/{id}/result` - Report deployment results

## Security Considerations

- **API Keys**: Agents authenticate using bearer tokens. Keep API keys secure.
- **Network**: Agents need outbound HTTPS access to container registries and the control plane.
- **Permissions**: Docker agent requires access to Docker socket. K8s agent needs appropriate RBAC permissions.
- **Secrets**: Never commit `.env` files or API keys to version control.
- **Trivy**: When enabled, agents download vulnerability databases. Ensure adequate disk space.

## Deployment

### Production Deployment

1. **Control Plane**:
   - Use a managed PostgreSQL instance
   - Set strong `JWT_SECRET`
   - Configure SMTP for notifications
   - Use reverse proxy (nginx/Caddy) with SSL

2. **Agents**:
   - Run as systemd services or in containers
   - Use secure API key storage (secrets management)
   - Configure appropriate scan intervals
   - Enable git integration for audit trail

### Docker Compose Production

```bash
cd control
cp server/.env.example server/.env
# Configure production values
docker-compose up -d
```

### Kubernetes Deployment

Deploy the control plane to Kubernetes using Helm charts:

```bash
helm repo add tiaki https://charts.tiaki.dev
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --namespace tiaki \
  --create-namespace
```

See the [charts documentation](charts/README.md) for detailed configuration options.

## Roadmap

- [x] Helm charts for Kubernetes deployment
- [ ] Slack/Discord notification integrations
- [ ] Scheduled deployment windows
- [ ] Multi-tenancy support
- [ ] Prometheus metrics export
- [x] Webhook support for custom integrations

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Website**: [tiaki.dev](https://tiaki.dev)
- **Documentation**: [docs.tiaki.dev](https://docs.tiaki.dev)
- **Issues**: [GitHub Issues](https://github.com/tiaki-dev/tiaki/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tiaki-dev/tiaki/discussions)

## Acknowledgments

Built with:

- [Go](https://golang.org/) - Agent runtime
- [Docker SDK](https://github.com/docker/docker) - Container management
- [Kubernetes Client](https://github.com/kubernetes/client-go) - K8s integration
- [React](https://react.dev/) - Frontend framework
- [tRPC](https://trpc.io/) - Type-safe API
- [Drizzle ORM](https://orm.drizzle.team/) - Database toolkit
- [shadcn/ui](https://ui.shadcn.com/) - UI components
