# Changelog

All notable changes to Tiaki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-03-23

### Added

- Docker socket proxy support via `tecnativa/docker-socket-proxy` to limit agent's Docker API access to required endpoints only
- Docker secrets support for registry credentials (`REGISTRY_AUTH_FILE`) as a secure alternative to environment variables
- `NewClientFromAuthFile` in the registry client to parse Docker auth JSON files (supports both base64 `auth` field and plain `username`/`password` fields)
- `secrets/` directory with `registry_auth.json.example` and setup documentation
- `DOCKER_SECURITY.md` quick-reference guide for enabling socket proxy and Docker secrets
- Documentation page for Docker security best practices (`docs/docs/configuration/docker-security.md`)
- Network isolation: all services now run in a dedicated `tiaki-internal` Docker bridge network

### Security

- Registry credentials can now be stored as Docker secrets instead of environment variables (not visible in `docker inspect` or process listings)
- `REGISTRY_AUTH_FILE` environment variable takes precedence over `REGISTRY_USERNAME`/`REGISTRY_PASSWORD` when set
- Secrets files (`secrets/*.json`, `*.key`, `*.pem`) excluded from version control via `.gitignore`

## [0.2.0] - 2026-03-23

### Added

- Helm charts for tiaki-agent and tiaki-control
- Documentation site (Docusaurus) with guides for configuration, deployment, and development
- Docker Hub descriptions for all published images
- Helm chart release automation in CI/CD pipeline

### Changed

- Upgraded PostgreSQL from version 16 to 17
- Upgraded dependencies to latest versions

### Security

- Security hardening for Dockerfiles: non-root user and apk upgrade

## [0.1.0] - 2025-01-22

### Added

- Initial development version
- Core agent functionality
- Basic control plane features
- Docker Compose support
- Kubernetes support
- Initial public release
- Docker agent for VM/Docker Compose environments
- Kubernetes agent for K8s clusters
- TypeScript control plane with React frontend
- Automatic container update detection
- One-click deployments and rollbacks
- Trivy integration for vulnerability scanning
- Git integration for docker-compose.yml changes
- Email notifications for updates and deployments
- Audit logging for all operations
- tRPC API with type-safe client/server communication
- PostgreSQL database with Drizzle ORM
- E2E test suite with Playwright

---

## Release Notes Template

When preparing a release, use this template:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New features

### Changed

- Changes to existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Security improvements
```

---

[Unreleased]: https://github.com/itlabs-gmbh/tiaki/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/itlabs-gmbh/tiaki/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/itlabs-gmbh/tiaki/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/itlabs-gmbh/tiaki/releases/tag/v0.1.0
