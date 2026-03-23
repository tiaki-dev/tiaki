<p align="center">
  <img src="logo.svg" alt="Tiaki Logo" width="80" height="80">
</p>

# Contributing to Tiaki

Thank you for your interest in contributing to Tiaki! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Docker/K8s version, Go/Node version)
- **Logs** from agent or control plane
- **Screenshots** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide detailed description** of the proposed feature
- **Explain why this enhancement would be useful**
- **List any alternatives** you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Ensure tests pass** (`go test ./...` for agents, `pnpm test` for control plane)
5. **Update documentation** if needed
6. **Write clear commit messages** following conventional commits
7. **Submit a pull request**

## Development Setup

### Control Plane

```bash
cd control
pnpm install

# Start dependencies
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
cd server && pnpm db:migrate

# Start dev servers
cd server && pnpm dev  # Terminal 1
cd client && pnpm dev  # Terminal 2
```

### Agent

```bash
cd agent
go mod download

# Run tests
go test ./...

# Build
go build -o bin/tiaki-agent-docker ./cmd/docker
go build -o bin/tiaki-agent-k8s ./cmd/k8s
```

## Coding Standards

### Go (Agent)

- Follow [Effective Go](https://golang.org/doc/effective_go) guidelines
- Use `gofmt` for formatting
- Run `go vet` before committing
- Maintain test coverage above 80%
- Use meaningful variable and function names
- Add comments for exported functions and types
- Handle errors explicitly, don't ignore them

Example:

```go
// ScanContainers retrieves all running containers and their metadata.
func (s *Scanner) ScanContainers(ctx context.Context) ([]Container, error) {
    containers, err := s.client.ContainerList(ctx, container.ListOptions{})
    if err != nil {
        return nil, fmt.Errorf("failed to list containers: %w", err)
    }
    // ...
}
```

### TypeScript (Control Plane)

- Use TypeScript strict mode
- Follow ESLint configuration
- Use functional components and hooks in React
- Prefer `const` over `let`, avoid `var`
- Use async/await over promise chains
- Add JSDoc comments for complex functions
- Keep components small and focused

Example:

```typescript
/**
 * Fetches container updates for a specific agent
 */
export const getContainerUpdates = async (
  agentId: string,
): Promise<Update[]> => {
  const updates = await db.query.updates.findMany({
    where: eq(updates.agentId, agentId),
    orderBy: desc(updates.detectedAt),
  });
  return updates;
};
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(agent): add support for private registries

Add authentication support for private Docker registries
using username/password credentials.

Closes #123
```

```
fix(control): prevent duplicate update notifications

Check for existing notifications before sending emails
to avoid spamming users with duplicate alerts.
```

## Testing

### Agent Tests

```bash
cd agent

# Run all tests
go test ./...

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run specific package
go test ./internal/docker

# Run with verbose output
go test -v ./...
```

### Control Plane Tests

```bash
cd control

# Run server tests
cd server && pnpm test

# Run with watch mode
pnpm test:watch

# Run E2E tests
cd .. && pnpm test:e2e
```

### E2E Tests

```bash
cd e2e

# Docker agent E2E
./run-e2e-audit.sh

# Kubernetes agent E2E
./run-e2e-k8s.sh

# Rollback E2E
./run-e2e-rollback.sh
```

## Project Structure

```
tiaki/
├── agent/                  # Go agents
│   ├── cmd/
│   │   ├── docker/        # Docker agent entrypoint
│   │   └── k8s/           # Kubernetes agent entrypoint
│   ├── internal/          # Internal packages
│   │   ├── compose/       # Docker Compose handling
│   │   ├── config/        # Configuration
│   │   ├── docker/        # Docker client wrapper
│   │   ├── executor/      # Deployment execution
│   │   ├── git/           # Git integration
│   │   ├── k8s/           # Kubernetes client wrapper
│   │   ├── registry/      # Registry client
│   │   ├── reporter/      # Control plane reporter
│   │   └── trivy/         # Trivy scanner integration
│   └── go.mod
├── control/               # TypeScript control plane
│   ├── client/           # React frontend
│   ├── server/           # tRPC API server
│   │   ├── src/
│   │   │   ├── db/       # Database schema and migrations
│   │   │   ├── routers/  # tRPC routers
│   │   │   ├── scheduler/ # Background jobs
│   │   │   └── lib/      # Utilities
│   │   └── drizzle/      # Migration files
│   └── e2e/              # Playwright E2E tests
├── e2e/                  # Integration test scripts
├── proto/                # API specification
└── docs/                 # Additional documentation
```

## Documentation

- Update README.md for user-facing changes
- Update API documentation in `proto/api.yaml` for API changes
- Add inline code comments for complex logic
- Update CHANGELOG.md for notable changes

## Release Process

Releases are managed by maintainers:

1. Update `CHANGELOG.md` with all changes under a new `## [X.Y.Z]` heading
2. Bump versions in `control/package.json`, `control/server/package.json`, `control/client/package.json`
3. Commit: `git commit -m "chore: release vX.Y.Z"`
4. Tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
5. Push: `git push origin main --tags`

GitHub Actions will automatically:

- Run all tests (Go agent + Node control plane) as a gate
- Build multi-arch Docker images (`linux/amd64` + `linux/arm64`) for all three components
- Push to Docker Hub under the `tiaki` organisation:
  - `tiaki/tiaki-agent-docker:X.Y.Z`
  - `tiaki/tiaki-agent-k8s:X.Y.Z`
  - `tiaki/tiaki-server:X.Y.Z`
- Create a GitHub Release with Docker pull commands and changelog excerpt

### Required GitHub Secrets

| Secret               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `DOCKERHUB_USERNAME` | Docker Hub username                                           |
| `DOCKERHUB_TOKEN`    | Docker Hub access token (Settings → Security → Access Tokens) |

## Questions?

- Open a [GitHub Discussion](https://github.com/itlabs-gmbh/tiaki/discussions)
- Check existing [Issues](https://github.com/itlabs-gmbh/tiaki/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
