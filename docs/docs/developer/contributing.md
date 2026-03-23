---
sidebar_position: 3
---

# Contributing

Thank you for your interest in contributing to Tiaki!

## Before you start

- Check [existing issues](https://github.com/tiaki-dev/tiaki/issues) to avoid duplicates
- For large changes, open an issue first to discuss the approach
- By contributing, you agree your code will be licensed under the MIT License

## Reporting bugs

Include in your bug report:
- Steps to reproduce
- Expected vs actual behavior
- OS, Docker/K8s version, Go/Node version
- Relevant logs from the agent or control plane

## Pull request workflow

1. Fork the repository and create a branch from `main`
2. Make your changes following the coding standards below
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request with a clear description

## Coding standards

### Go (agent)

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Run `gofmt -w .` and `go vet ./...` before committing
- Maintain >80% test coverage
- Comment all exported types and functions
- Wrap errors: `fmt.Errorf("context: %w", err)` — never swallow errors

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

### TypeScript (control plane)

- Strict mode; follow the ESLint config
- Functional React components and hooks only
- `const` > `let`; async/await over promise chains
- Use Drizzle query builder; avoid raw SQL unless necessary
- Package manager: **pnpm** (not npm/yarn)

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scopes**: `agent`, `control`, `registry`, `k8s`, `docker`, `e2e`

Examples:
```
feat(agent): add support for private registries
fix(control): prevent duplicate update notifications
docs(api): update heartbeat endpoint description
```

## Release process

Releases are managed by maintainers:

1. Update `CHANGELOG.md` under a new `## [X.Y.Z]` heading
2. Bump versions in `control/package.json` and sub-packages
3. Commit: `git commit -m "chore: release vX.Y.Z"`
4. Tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
5. Push: `git push origin main --tags`

GitHub Actions automatically builds multi-arch Docker images and creates a GitHub Release.

## Questions?

- [GitHub Discussions](https://github.com/tiaki-dev/tiaki/discussions)
- [GitHub Issues](https://github.com/tiaki-dev/tiaki/issues)
