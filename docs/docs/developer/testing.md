---
sidebar_position: 4
---

# Testing

## Agent (Go)

```bash
cd agent

# Run all tests
go test ./...

# Run with coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run a single package verbosely
go test -v ./internal/registry

# Run a single test by name
go test -v -run TestCheckForUpdate ./internal/registry
```

Target: **>80% coverage** across all packages.

### Writing agent tests

Prefer pure functions for testability. The registry package is a good example — `checkForUpdateDigest` and `checkForUpdateSemver` take explicit inputs and return deterministic results, making them easy to unit test without mocking Docker or network calls.

```go
func TestCheckForUpdateSemver(t *testing.T) {
    tests := []struct {
        current  string
        latest   string
        hasUpdate bool
    }{
        {"v1.0.0", "v1.1.0", true},
        {"v1.1.0", "v1.0.0", false},
        {"v1.0.0", "v1.0.0", false},
    }
    for _, tt := range tests {
        got := checkForUpdateSemver(tt.current, tt.latest)
        if got != tt.hasUpdate {
            t.Errorf("checkForUpdateSemver(%q, %q) = %v, want %v",
                tt.current, tt.latest, got, tt.hasUpdate)
        }
    }
}
```

## Control plane (TypeScript)

```bash
cd control

# Run all server unit tests (Vitest)
pnpm test

# Watch mode
cd server && pnpm test:watch

# Coverage
cd server && pnpm test -- --coverage
```

### Playwright E2E tests

```bash
cd control

# Run all E2E tests (requires running control plane + DB)
pnpm test:e2e

# Run a specific spec file
pnpm test:e2e -- e2e/containers.spec.ts

# Show browser (headed mode)
pnpm test:e2e -- --headed

# Debug interactively
pnpm test:e2e -- --debug
```

E2E test specs live in `control/e2e/`:
- `containers.spec.ts` — container listing and update detection
- `audit-log.spec.ts` — audit log entries after deployments

Auth state is persisted in `control/e2e/.auth-state.json` to avoid repeated logins.

## Integration tests (shell-based)

```bash
cd e2e

# Spins up a real Docker Compose environment and runs the agent against it
./run-e2e-audit.sh

# Spins up a real K8s cluster (requires kind or similar) and runs K8s agent
./run-e2e-k8s.sh

# Tests rollback: deploys, then rolls back, verifies the old image is restored
./run-e2e-rollback.sh
```

These tests run as part of CI on pull requests to `main`.

## CI pipeline

Tests run automatically via GitHub Actions on every push and PR:

| Job | Command | Trigger |
|---|---|---|
| `agent-test` | `go vet ./... && go test ./...` | push/PR to main |
| `control-test` | `pnpm test` | push/PR to main |
| `control-build` | `pnpm build` | push/PR to main |

See `@/Users/flofi/dev/tiaki/.github/workflows/ci.yml` for the full workflow definition.
